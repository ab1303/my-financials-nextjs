#!/usr/bin/env node
/**
 * spec-check.mjs
 *
 * Deterministic spec ↔ code drift + boundary detector.
 *
 * Reads `spec/index.json` and reports, for each feature:
 *   - DRIFT:    files in `owns` that changed between `lastVerifiedSha` and HEAD
 *   - OVERLAP:  files claimed by more than one feature (boundary violation;
 *               recomputed live from `owns[]` each run — `index.overlaps` is
 *               ignored, since stale stored state is exactly the failure mode
 *               this gate exists to prevent).
 *   - REVIEW:   features still flagged `needsReview: true` (unverified ownership)
 *   - GHOST:    files listed in `owns` that no longer exist in the working tree
 *
 * Exit codes:
 *   0  no findings (or only --warn flags raised without --strict)
 *   1  drift / overlap / ghost / review findings raised under --strict
 *   2  spec/index.json missing or malformed
 *   3  not a git repo / git unavailable
 *
 * Modes:
 *   default          human-readable report, exit 0 unless --strict
 *   --strict         non-zero exit if ANY finding (use in CI)
 *   --json           emit a JSON report to stdout
 *   --feature=<id>   restrict to a single feature id
 *   --no-review      suppress REVIEW findings (still reports drift/overlap/ghost)
 *
 * Per docs/harness-audit.md and docs/context-engineering.md, this script is the
 * load-bearing piece that makes `spec/index.json` more than just a list.
 *
 * IMPORTANT: this script never calls an LLM and never writes files. It is
 * Tier 1 (read-only). Resolution of any finding it raises must go through the
 * `doubt-driven-development` skill — see `.agents/skills/doubt-driven-development/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const INDEX_PATH = path.join(REPO_ROOT, 'spec', 'index.json');

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const JSON_OUT = args.includes('--json');
const NO_REVIEW = args.includes('--no-review');
const featureArg = args.find(a => a.startsWith('--feature='))?.split('=')[1];

function die(code, msg) {
  process.stderr.write(msg + '\n');
  process.exit(code);
}

if (!fs.existsSync(INDEX_PATH)) {
  die(2, `spec/index.json not found. Run: node scripts/harness/spec-manifest/generate-spec-index.mjs`);
}

let index;
try {
  index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
} catch (e) {
  die(2, `spec/index.json malformed: ${e.message}`);
}

let headSha;
try {
  headSha = execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
} catch {
  die(3, `git unavailable in ${REPO_ROOT}`);
}

/** Return list of files changed in `paths` between `sha` and HEAD. */
function changedSince(sha, paths) {
  if (!paths || paths.length === 0) return [];
  // Resilience: if the sha doesn't exist (rebased away), surface that instead of
  // crashing — caller treats it as "needs re-verification".
  try {
    // Use `git rev-parse --verify` instead of `git cat-file -e sha^{commit}` to
    // avoid Windows cmd.exe interpreting `^` as an escape character.
    execSync(`git rev-parse --verify ${sha}`, { cwd: REPO_ROOT, stdio: 'ignore' });
  } catch {
    return { error: `lastVerifiedSha ${sha} not reachable from HEAD (rebased or deleted)` };
  }
  // Chunk paths to avoid hitting Windows command-line length limits.
  const CHUNK = 80;
  const changed = new Set();
  for (let i = 0; i < paths.length; i += CHUNK) {
    const slice = paths.slice(i, i + CHUNK);
    const out = execSync(
      `git diff --name-only ${sha}..HEAD -- ${slice.map(p => `"${p}"`).join(' ')}`,
      { cwd: REPO_ROOT },
    ).toString().trim();
    if (out) for (const f of out.split(/\r?\n/)) if (f) changed.add(f);
  }
  return [...changed];
}

function ownsFiles(feature) {
  return Object.values(feature.owns ?? {}).flat();
}

const features = featureArg
  ? index.features.filter(f => f.id === featureArg)
  : index.features;

if (featureArg && features.length === 0) die(2, `Unknown feature id: ${featureArg}`);

const findings = {
  drift: [],     // { id, sha, changedFiles[] }
  overlap: [],   // passed through from index
  review: [],    // { id, reason }
  ghost: [],     // { id, missingFiles[] }
  shaMissing: [],// { id, sha, message }
};

for (const f of features) {
  // ADR entries describe architectural decisions, not features. They legitimately own
  // no source files, so all per-file detections (ghost, drift, review) are skipped.
  // Overlap is still computed below (precomputed in the manifest) — ADRs have empty
  // owns[] so they cannot participate in overlaps anyway.
  if (f.status === 'adr') continue;

  const files = ownsFiles(f);

  // GHOST detection
  if (files.length > 0) {
    const missing = files.filter(p => !fs.existsSync(path.join(REPO_ROOT, p)));
    if (missing.length) findings.ghost.push({ id: f.id, missingFiles: missing });
  }

  // DRIFT detection
  if (f.lastVerifiedSha && files.length > 0) {
    const changed = changedSince(f.lastVerifiedSha, files);
    if (Array.isArray(changed) && changed.length) {
      findings.drift.push({ id: f.id, sha: f.lastVerifiedSha, changedFiles: changed });
    } else if (!Array.isArray(changed) && changed.error) {
      findings.shaMissing.push({ id: f.id, sha: f.lastVerifiedSha, message: changed.error });
    }
  }

  // REVIEW detection
  if (!NO_REVIEW && f.needsReview) {
    let reason;
    if (!f.lastVerifiedSha) reason = 'no lastVerifiedSha — ownership never confirmed';
    else if (f.ownsConfidence === 'none') reason = 'owns is empty — feature has no known source files';
    else reason = `needsReview: true (ownsConfidence=${f.ownsConfidence})`;
    findings.review.push({ id: f.id, reason });
  }
}

// OVERLAP — recomputed live from current owns[] across ALL features (never read
// from index.overlaps, which is stale stored state). A file claimed by >1 feature
// is a boundary defect: two specs both assert authority over the same contract.
// Note: this scans the full feature list even when --feature=<id> is supplied,
// so overlap signal is always global (it has to be — overlap is a relationship).
// Stream C guard: read `owns[]` only, never `consumes[]` (see
// spec/harness/consumes-derivation/lld.md § Stream C — `spec:check` additive guard).
const overlapOwners = new Map(); // file -> Set<featureId>
for (const f of index.features) {
  if (f.status === 'adr') continue; // ADRs own no code, can't overlap
  const ownedBuckets = f.owns ?? {}; // explicit `owns` access; ignore derived `consumes`
  for (const file of ownsFiles({ owns: ownedBuckets })) {
    if (!overlapOwners.has(file)) overlapOwners.set(file, new Set());
    overlapOwners.get(file).add(f.id);
  }
}
const allOverlaps = [];
for (const [file, ids] of overlapOwners) {
  if (ids.size > 1) allOverlaps.push({ file, claimedBy: [...ids].sort() });
}
findings.overlap = featureArg
  ? allOverlaps.filter(o => o.claimedBy.includes(featureArg))
  : allOverlaps;

// --- Output ---
const totals = {
  drift: findings.drift.length,
  overlap: findings.overlap.length,
  review: findings.review.length,
  ghost: findings.ghost.length,
  shaMissing: findings.shaMissing.length,
};

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({
    headSha,
    generatedFromSha: index.generatedFromSha,
    totals,
    findings,
  }, null, 2) + '\n');
} else {
  const header = `spec:check  ·  HEAD=${headSha.slice(0,8)}  ·  index=${(index.generatedFromSha ?? '?').slice(0,8)}`;
  process.stdout.write(`\n${header}\n${'─'.repeat(header.length)}\n`);

  const section = (title, count, body) => {
    const tag = count === 0 ? '✓' : '✗';
    process.stdout.write(`\n${tag} ${title} (${count})\n`);
    if (count) process.stdout.write(body + '\n');
  };

  section('DRIFT — owns files changed since lastVerifiedSha', totals.drift,
    findings.drift.map(d =>
      `  ${d.id}  (since ${d.sha.slice(0,8)})\n` +
      d.changedFiles.map(f => `    · ${f}`).join('\n')
    ).join('\n\n'));

  section('OVERLAP — file claimed by >1 feature', totals.overlap,
    findings.overlap.map(o => `  ${o.file}\n    claimed by: ${o.claimedBy.join(', ')}`).join('\n\n'));

  section('GHOST — owns file no longer exists', totals.ghost,
    findings.ghost.map(g =>
      `  ${g.id}\n` + g.missingFiles.map(f => `    · ${f}`).join('\n')
    ).join('\n\n'));

  section('SHA-MISSING — lastVerifiedSha unreachable', totals.shaMissing,
    findings.shaMissing.map(s => `  ${s.id}  → ${s.message}`).join('\n'));

  if (!NO_REVIEW) section('REVIEW — ownership unverified', totals.review,
    findings.review.map(r => `  ${r.id}  → ${r.reason}`).join('\n'));

  process.stdout.write(`\nTotals: drift=${totals.drift} overlap=${totals.overlap} ghost=${totals.ghost} sha-missing=${totals.shaMissing} review=${totals.review}\n`);
  if (STRICT) process.stdout.write(`Mode: --strict (any finding fails CI)\n`);
  process.stdout.write(`Next: resolve findings via the doubt-driven-development skill.\n\n`);
}

const blocking = totals.drift + totals.overlap + totals.ghost + totals.shaMissing + (NO_REVIEW ? 0 : totals.review);
let exitCode = STRICT && blocking > 0 ? 1 : 0;

// --- Capsule staleness check (harness.capsule-format) ---
// Invoke check.mjs only when capsules exist (i.e., after first generate run).
// This is additive: capsule failures are reported but do NOT alter the existing
// blocking/exit-code logic of spec-check.mjs for backwards compatibility.
// When --strict is passed, capsule failures also fail the gate.
try {
  const checkMjs = path.join(REPO_ROOT, 'scripts', 'harness', 'capsule-format', 'check.mjs');
  if (fs.existsSync(checkMjs)) {
    const { checkCapsules } = await import(pathToFileURL(checkMjs).href);
    const capsuleResult = await checkCapsules({ repoRoot: REPO_ROOT, dryRun: true, strict: STRICT });
    if (!JSON_OUT) {
      process.stdout.write('\n--- Capsule staleness ---\n');
      process.stdout.write(capsuleResult.summary + '\n');
    }
    if (STRICT && capsuleResult.exitCode !== 0 && exitCode === 0) {
      exitCode = capsuleResult.exitCode;
    }
  }
} catch (e) {
  if (!JSON_OUT) process.stderr.write(`capsule check skipped: ${e.message}\n`);
}

process.exit(exitCode);