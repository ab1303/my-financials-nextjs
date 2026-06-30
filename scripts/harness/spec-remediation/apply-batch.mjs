#!/usr/bin/env node
/**
 * apply-batch.mjs — apply every patches-batch-N/task-*.json in deterministic order.
 *
 * Usage:
 *   node scripts/harness/spec-remediation/apply-batch.mjs --batch <N> [--continue-on-error] [--dry-run]
 *
 * Iterates patches-batch-N/task-*.json sorted by taskId. Calls apply-patch.mjs
 * on each via a child process so each application is fully isolated (a crash
 * in one cannot corrupt the manifest for the next — manifest writes are
 * atomic via write-temp + rename).
 *
 * Stops on first rollback unless --continue-on-error is supplied.
 *
 * Updates per-task status in the corresponding step{N}-tasks.json files. The
 * step number is derived from each patch's `step` field, so a single batch
 * folder may contain patches from multiple steps (rare but supported).
 *
 * NEVER calls git. NEVER commits. Per LLD invariant #4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from './lib/manifest.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY_PATCH = path.join(SCRIPT_DIR, 'apply-patch.mjs');
const REMEDIATION_DIR = path.join(REPO_ROOT, '.harness', 'remediation');

const args = process.argv.slice(2);
const batchArgIdx = args.indexOf('--batch');
const batchN = batchArgIdx >= 0 ? Number(args[batchArgIdx + 1]) : NaN;
const CONTINUE = args.includes('--continue-on-error');
const DRY_RUN = args.includes('--dry-run');

function die(code, msg) {
  process.stderr.write(`apply-batch: ${msg}\n`);
  process.exit(code);
}

if (!Number.isInteger(batchN) || batchN < 1) {
  die(2, 'usage: --batch <N> [--continue-on-error] [--dry-run]');
}

const batchDir = path.join(REMEDIATION_DIR, `patches-batch-${batchN}`);
if (!fs.existsSync(batchDir)) die(2, `batch dir not found: ${path.relative(REPO_ROOT, batchDir)}`);

const patchFiles = fs.readdirSync(batchDir)
  .filter((f) => /^task-step[123]-t\d{3,}\.json$/.test(f))
  .sort();

if (patchFiles.length === 0) die(2, `no task-*.json patches in ${path.relative(REPO_ROOT, batchDir)}`);

process.stdout.write(`apply-batch: ${patchFiles.length} patch(es) in batch-${batchN}\n`);

let applied = 0;
let rolledBack = 0;
let invalid = 0;

for (const f of patchFiles) {
  const abs = path.join(batchDir, f);
  const cmdArgs = ['--patch', abs];
  if (DRY_RUN) cmdArgs.push('--dry-run');

  const result = spawnSync(process.execPath, [APPLY_PATCH, ...cmdArgs], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout || '');
  if (result.stderr) process.stderr.write(result.stderr);

  let taskId = null;
  try { taskId = JSON.parse(fs.readFileSync(abs, 'utf8')).taskId; } catch {}

  switch (result.status) {
    case 0:
      applied += 1;
      if (taskId) updateTaskStatus(taskId, 'applied', abs);
      break;
    case 1:
      rolledBack += 1;
      if (taskId) updateTaskStatus(taskId, 'rejected', abs);
      if (!CONTINUE) {
        process.stderr.write(`apply-batch: stopping on rollback (use --continue-on-error to override)\n`);
        summary({ applied, rolledBack, invalid, total: patchFiles.length });
        process.exit(1);
      }
      break;
    default:
      invalid += 1;
      if (taskId) updateTaskStatus(taskId, 'rejected', abs);
      if (!CONTINUE) {
        process.stderr.write(`apply-batch: stopping on error (exit ${result.status})\n`);
        summary({ applied, rolledBack, invalid, total: patchFiles.length });
        process.exit(result.status || 2);
      }
  }
}

summary({ applied, rolledBack, invalid, total: patchFiles.length });
process.exit(rolledBack + invalid > 0 ? 1 : 0);

// ---------------------------------------------------------------------------

function summary({ applied, rolledBack, invalid, total }) {
  process.stdout.write(
    `\napply-batch: ${applied}/${total} applied · ${rolledBack} rolled back · ${invalid} invalid\n`,
  );
}

function updateTaskStatus(taskId, status, patchAbsPath) {
  const m = taskId.match(/^step([123])-/);
  if (!m) return;
  const tasksFile = path.join(REMEDIATION_DIR, `step${m[1]}-tasks.json`);
  if (!fs.existsSync(tasksFile)) return;
  let doc;
  try { doc = JSON.parse(fs.readFileSync(tasksFile, 'utf8')); } catch { return; }
  const t = (doc.tasks ?? []).find((x) => x.id === taskId);
  if (!t) return;
  t.status = status;
  t.appliedAt = new Date().toISOString();

  const auditPath = patchAbsPath.replace(/\.json$/, '.applied.json');
  if (fs.existsSync(auditPath)) {
    try {
      const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      if (typeof audit.overlapBefore === 'number' && typeof audit.overlapAfter === 'number') {
        t.outcome = {
          overlapBefore: audit.overlapBefore,
          overlapAfter: audit.overlapAfter,
          patchPath: path.relative(REPO_ROOT, patchAbsPath).split(path.sep).join('/'),
        };
      }
      if (audit.reason) t.stopReason = audit.reason;
    } catch {}
  }

  fs.writeFileSync(tasksFile, JSON.stringify(doc, null, 2) + '\n');
}
