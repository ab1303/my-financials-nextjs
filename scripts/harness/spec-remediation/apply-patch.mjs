#!/usr/bin/env node
/**
 * apply-patch.mjs — apply ONE patch to spec/index.json + verify + rollback.
 *
 * Usage:
 *   node scripts/harness/spec-remediation/apply-patch.mjs --patch <path-to-patch.json> [--dry-run]
 *
 * 1. Reads patch JSON.
 * 2. Validates against the LLD patch contract (lib/patch.mjs#validatePatch).
 * 3. Refuses if any op affects a feature other than `patch.feature`.
 * 4. Computes overlap count via lib/overlaps.mjs (deterministic mirror of
 *    scripts/harness/spec-manifest/spec-check.mjs — same logic, no shell).
 * 5. Applies ops to spec/index.json atomically (write-temp + rename).
 * 6. Recomputes overlap. If overlap did not strictly decrease AND ops include
 *    `remove-files-from-owns` (the only ops that should reduce overlaps),
 *    reverts the manifest write and exits 1.
 * 7. Writes <patch-path>.applied.json audit row.
 * 8. Appends an entry to .harness/remediation/log.md (newest-first).
 *
 * NEVER calls git. NEVER commits. Per LLD invariant #4.
 *
 * Exit codes:
 *   0 applied + verified
 *   1 rolled back (overlap regression)
 *   2 schema invalid / file missing
 *   3 manifest mutation conflict (target feature missing, etc.)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  readManifest,
  writeManifestAtomic,
  cloneManifest,
  REPO_ROOT,
  INDEX_PATH,
} from './lib/manifest.mjs';
import { overlapCount, overlapParticipations } from './lib/overlaps.mjs';
import { validatePatch, applyPatch } from './lib/patch.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const patchArgIdx = args.indexOf('--patch');
const patchPath = patchArgIdx >= 0 ? args[patchArgIdx + 1] : null;

function die(code, msg) {
  process.stderr.write(`apply-patch: ${msg}\n`);
  process.exit(code);
}

if (!patchPath) die(2, 'usage: --patch <path-to-patch.json> [--dry-run]');
const absPatchPath = path.isAbsolute(patchPath) ? patchPath : path.resolve(process.cwd(), patchPath);
if (!fs.existsSync(absPatchPath)) die(2, `patch file not found: ${absPatchPath}`);

let patch;
try {
  patch = JSON.parse(fs.readFileSync(absPatchPath, 'utf8'));
} catch (e) {
  die(2, `patch JSON malformed: ${e.message}`);
}

const validation = validatePatch(patch);
if (!validation.ok) {
  die(2, `patch failed schema validation:\n  - ${validation.errors.join('\n  - ')}`);
}

const manifestBefore = readManifest();
const targetFeature = manifestBefore.features.find((f) => f.id === patch.feature);
if (!targetFeature) {
  die(3, `patch.feature '${patch.feature}' not present in manifest`);
}

const overlapBefore = overlapCount(manifestBefore);
const partsBefore = overlapParticipations(manifestBefore);

let manifestAfter, changed;
try {
  ({ manifest: manifestAfter, changed } = applyPatch(manifestBefore, patch));
} catch (e) {
  die(3, e.message);
}

const overlapAfter = overlapCount(manifestAfter);
const partsAfter = overlapParticipations(manifestAfter);

// Idempotency: re-applying an already-applied patch is a logical success but
// we still report it as such (and never write to disk).
if (!changed) {
  const audit = {
    taskId: patch.taskId,
    appliedAt: new Date().toISOString(),
    status: 'noop',
    overlapBefore,
    overlapAfter,
    partsBefore,
    partsAfter,
    note: 'patch was a no-op (idempotent re-apply)',
    dryRun: DRY_RUN,
  };
  writeAudit(absPatchPath, audit);
  appendLog(`${audit.appliedAt}  ${patch.taskId}  noop  files ${overlapBefore} → ${overlapAfter}  parts ${partsBefore} → ${partsAfter}`);
  process.stdout.write(`apply-patch: no-op — manifest unchanged (files ${overlapBefore}, parts ${partsBefore})\n`);
  process.exit(0);
}

// Rollback guard: if the patch contains remove-files-from-owns ops, overlap
// PARTICIPATIONS must strictly decrease. Participations = sum of claimedBy
// counts across overlapping files; removing one redundant ownership always
// drops this by 1, even when the file remains overlapping (≥2 claimants).
// File count alone is too strict — it only changes when a file drops from 2
// to 1 owner. Step-2-only patches (set-invariants, set-status,
// set-owns-confidence) may legitimately leave overlap unchanged.
const hasRemove = patch.ops.some((o) => o.op === 'remove-files-from-owns');
if (hasRemove && partsAfter >= partsBefore) {
  const audit = {
    taskId: patch.taskId,
    appliedAt: new Date().toISOString(),
    status: 'rolled_back',
    overlapBefore,
    overlapAfter,
    partsBefore,
    partsAfter,
    reason: `remove-files-from-owns op did not reduce overlap participations (${partsBefore} → ${partsAfter})`,
    dryRun: DRY_RUN,
  };
  writeAudit(absPatchPath, audit);
  appendLog(`${audit.appliedAt}  ${patch.taskId}  ROLLBACK  parts ${partsBefore} → ${partsAfter}  (no decrease)`);
  process.stderr.write(`apply-patch: rolled back — overlap participations did not strictly decrease (${partsBefore} → ${partsAfter})\n`);
  process.exit(1);
}

if (!DRY_RUN) {
  writeManifestAtomic(manifestAfter);
} else {
  process.stdout.write(`apply-patch: [dry-run] would write ${path.relative(REPO_ROOT, INDEX_PATH)}\n`);
}

const audit = {
  taskId: patch.taskId,
  appliedAt: new Date().toISOString(),
  status: DRY_RUN ? 'dry_run' : 'applied',
  overlapBefore,
  overlapAfter,
  partsBefore,
  partsAfter,
  opsApplied: patch.ops.length,
  feature: patch.feature,
  dryRun: DRY_RUN,
};
writeAudit(absPatchPath, audit);
appendLog(
  `${audit.appliedAt}  ${patch.taskId}  ${audit.status}  ${patch.feature}  ` +
  `files ${overlapBefore} → ${overlapAfter}  parts ${partsBefore} → ${partsAfter}  (${patch.ops.length} op(s))`,
);

process.stdout.write(
  `apply-patch: ${audit.status} — files ${overlapBefore} → ${overlapAfter}  parts ${partsBefore} → ${partsAfter} (${patch.feature})\n`,
);
process.exit(0);

// ---------------------------------------------------------------------------

function writeAudit(patchAbsPath, audit) {
  const auditPath = patchAbsPath.replace(/\.json$/, '.applied.json');
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n');
}

function appendLog(line) {
  const logPath = path.join(REPO_ROOT, '.harness', 'remediation', 'log.md');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  // Newest-first: prepend.
  const prior = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '# Spec Remediation — Apply Log\n\n_Newest entries first._\n\n';
  const header = '# Spec Remediation — Apply Log\n\n_Newest entries first._\n\n';
  const body = prior.startsWith('# Spec Remediation — Apply Log')
    ? prior.slice(header.length)
    : prior;
  fs.writeFileSync(logPath, header + `- ${line}\n` + body);
}
