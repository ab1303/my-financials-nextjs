#!/usr/bin/env node
/**
 * discover.mjs — build .harness/remediation/step{N}-tasks.json from spec/index.json.
 *
 * Usage: node scripts/harness/spec-remediation/discover.mjs --step <1|2|3> [--force]
 *
 * Step 1: enumerates files in `transactions.transactions.owns` that also appear
 *         in any transactions.* or cashflow.multi-account-transfer-integrity.*
 *         sub-feature's owns. Groups by target sub-feature → one task per
 *         (subject, target) pair.
 *
 * Step 2: enumerates features whose lld.md is short (≤30 non-blank lines),
 *         whose id suggests cross-cutting (parity/integrity/audit/source-of-truth),
 *         AND whose current owns[] overlaps multiple peer features. Heuristic;
 *         the sub-agent confirms or rejects.
 *
 * Step 3: enumerates files with >1 claimant in the current manifest. One task
 *         per file. The sub-agent picks the canonical owner; this prompt is
 *         invoked once per file (it removes from one loser per invocation).
 *
 * Refuses to overwrite an existing tasks file with pending tasks unless --force
 * is supplied. Exit codes: 0 success | 2 manifest malformed | 3 git unavailable.
 *
 * NEVER calls git for writes. NEVER commits. Tier 1 (read-only) on the manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest, REPO_ROOT } from './lib/manifest.mjs';
import { computeOverlaps, ownsFiles } from './lib/overlaps.mjs';
import { loadTemplate } from './lib/prompts.mjs';

const REMEDIATION_DIR = path.join(REPO_ROOT, '.harness', 'remediation');

const args = process.argv.slice(2);
const stepArg = args.find((a) => a.startsWith('--step'));
const FORCE = args.includes('--force');

function die(code, msg) {
  process.stderr.write(`discover: ${msg}\n`);
  process.exit(code);
}

const stepMatch = stepArg && stepArg.match(/^--step[= ]?(\d)?$/);
let step = null;
if (stepArg) {
  // support both --step=1 and --step 1
  const eq = stepArg.split('=')[1];
  if (eq) step = Number(eq);
  else {
    const next = args[args.indexOf(stepArg) + 1];
    step = Number(next);
  }
}
if (![1, 2, 3].includes(step)) {
  die(2, 'usage: --step <1|2|3>');
}

let manifest;
try {
  manifest = readManifest();
} catch (e) {
  die(2, e.message);
}

fs.mkdirSync(REMEDIATION_DIR, { recursive: true });
const outPath = path.join(REMEDIATION_DIR, `step${step}-tasks.json`);

if (fs.existsSync(outPath) && !FORCE) {
  try {
    const prior = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const pending = (prior.tasks ?? []).filter((t) => t.status === 'pending' || t.status === 'dispatched');
    if (pending.length > 0) {
      die(2,
        `${path.relative(REPO_ROOT, outPath)} exists with ${pending.length} pending/dispatched task(s). ` +
        `Re-run with --force to discard and regenerate.`);
    }
  } catch (e) {
    die(2, `existing tasks file unreadable (${e.message}); use --force to overwrite`);
  }
}

// Pre-load the template for this step to surface authoring errors at discover time.
const templateName = {
  1: 'step1-scope-down.md',
  2: 'step2-invariant-classify.md',
  3: 'step3-overlap-decide.md',
}[step];
try {
  loadTemplate(templateName);
} catch (e) {
  die(2, `template '${templateName}' failed validation: ${e.message}`);
}

const now = new Date().toISOString();
const tasks = step === 1
  ? discoverStep1(manifest)
  : step === 2
    ? discoverStep2(manifest)
    : discoverStep3(manifest);

const payload = {
  $schema: '../../scripts/harness/spec-remediation/schema/task.schema.json',
  generatedAt: now,
  step,
  tasks,
};

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
process.stdout.write(
  `discover: wrote ${tasks.length} task(s) to ${path.relative(REPO_ROOT, outPath)}\n`,
);
process.exit(0);

// ---------------------------------------------------------------------------

function makeIdGen(step) {
  let n = 0;
  return () => `step${step}-t${String(++n).padStart(3, '0')}`;
}

function fileExists(p) {
  return fs.existsSync(path.join(REPO_ROOT, p));
}

function nonBlankLines(absPath) {
  if (!fs.existsSync(absPath)) return Infinity;
  return fs.readFileSync(absPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .length;
}

/**
 * Step 1: scope-down candidates from transactions.transactions.
 * Groups overlapping files by their *other* claimant (the target sub-feature).
 */
function discoverStep1(manifest) {
  const SUBJECT_ID = 'transactions.transactions';
  const TARGET_PREFIXES = ['transactions.', 'cashflow.multi-account-transfer-integrity'];

  const subject = manifest.features.find((f) => f.id === SUBJECT_ID);
  if (!subject) {
    die(2, `step 1 requires feature '${SUBJECT_ID}' in manifest`);
  }
  const subjectFiles = new Set(ownsFiles(subject));
  const overlaps = computeOverlaps(manifest);

  // target id -> Set<file>
  const byTarget = new Map();
  for (const { file, claimedBy } of overlaps.byFile) {
    if (!subjectFiles.has(file)) continue;
    for (const id of claimedBy) {
      if (id === SUBJECT_ID) continue;
      if (!TARGET_PREFIXES.some((p) => id === p.replace(/\.$/, '') || id.startsWith(p))) continue;
      if (!byTarget.has(id)) byTarget.set(id, new Set());
      byTarget.get(id).add(file);
    }
  }

  const nextId = makeIdGen(1);
  const tasks = [];
  for (const [targetId, files] of [...byTarget.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const target = manifest.features.find((f) => f.id === targetId);
    if (!target) continue;
    tasks.push({
      id: nextId(),
      step: 1,
      status: 'pending',
      subject: SUBJECT_ID,
      target: targetId,
      files: [...files].sort(),
      claimants: null,
      promptTemplate: 'step1-scope-down.md',
      createdAt: now,
      dispatchedAt: null,
      appliedAt: null,
      outcome: null,
      stopReason: null,
    });
  }
  return tasks;
}

/**
 * Step 2: cross-cutting candidates. Heuristic — sub-agent confirms.
 */
function discoverStep2(manifest) {
  const CROSS_CUTTING_HINTS = /(parity|integrity|audit|source-of-truth|exclusion|consistency)/i;
  const overlaps = computeOverlaps(manifest);
  const participants = overlaps.byFeature; // Map<id, count>

  const nextId = makeIdGen(2);
  const tasks = [];
  for (const f of manifest.features) {
    if (f.status === 'adr') continue;
    if (!CROSS_CUTTING_HINTS.test(f.id)) continue;
    const participation = participants.get(f.id) ?? 0;
    if (participation < 1) continue;

    const lldAbs = f.docs?.lld ? path.join(REPO_ROOT, f.docs.lld) : null;
    const lldSize = lldAbs ? nonBlankLines(lldAbs) : Infinity;
    if (lldSize > 30) continue;

    const files = ownsFiles(f);
    if (files.length === 0) continue;

    tasks.push({
      id: nextId(),
      step: 2,
      status: 'pending',
      subject: f.id,
      target: null,
      files: [...files].sort(),
      claimants: null,
      promptTemplate: 'step2-invariant-classify.md',
      createdAt: now,
      dispatchedAt: null,
      appliedAt: null,
      outcome: null,
      stopReason: null,
    });
  }
  return tasks;
}

/**
 * Step 3: every file still contested (>1 claimant). One task per file.
 * `subject` is set to the first claimant alphabetically — purely informational;
 * the sub-agent decides which claimant loses, which determines `patch.feature`.
 */
function discoverStep3(manifest) {
  const overlaps = computeOverlaps(manifest);
  const nextId = makeIdGen(3);
  const tasks = [];
  for (const { file, claimedBy } of overlaps.byFile) {
    if (!fileExists(file)) continue; // ghost — different problem
    tasks.push({
      id: nextId(),
      step: 3,
      status: 'pending',
      subject: claimedBy[0],
      target: null,
      files: [file],
      claimants: [...claimedBy],
      promptTemplate: 'step3-overlap-decide.md',
      createdAt: now,
      dispatchedAt: null,
      appliedAt: null,
      outcome: null,
      stopReason: null,
    });
  }
  return tasks;
}
