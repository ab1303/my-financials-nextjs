#!/usr/bin/env node
/**
 * report.mjs — orientation dashboard for spec-remediation.
 *
 * Usage:
 *   node scripts/harness/spec-remediation/report.mjs [--step N] [--final] [--verbose]
 *
 * Prints:
 *   - Live spec:check overlap total (recomputed from owns[] — does NOT shell to pnpm)
 *   - Per-step task queue: pending / dispatched / applied / rejected / escalated
 *   - Last 5 entries from .harness/remediation/log.md
 *   - Top-10 features by current overlap participation
 *
 * Used at session start and between batches. Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readManifest, REPO_ROOT } from './lib/manifest.mjs';
import { computeOverlaps, overlapParticipations } from './lib/overlaps.mjs';

const REMEDIATION_DIR = path.join(REPO_ROOT, '.harness', 'remediation');
const args = process.argv.slice(2);
const FINAL = args.includes('--final');
const VERBOSE = args.includes('--verbose');
const stepArg = args.find((a) => a.startsWith('--step'));
const onlyStep = stepArg ? Number(stepArg.split('=')[1] ?? args[args.indexOf(stepArg) + 1]) : null;

let manifest;
try {
  manifest = readManifest();
} catch (e) {
  process.stderr.write(`report: ${e.message}\n`);
  process.exit(2);
}

const overlaps = computeOverlaps(manifest);
const parts = overlapParticipations(manifest);
const header = `spec-remediation report  ·  features=${manifest.features.length}  ·  overlap-files=${overlaps.count}  ·  overlap-parts=${parts}`;
process.stdout.write(`\n${header}\n${'─'.repeat(header.length)}\n`);

// Per-step queue
const stepsToShow = onlyStep ? [onlyStep] : [1, 2, 3];
process.stdout.write(`\nTask queues:\n`);
for (const s of stepsToShow) {
  const tasksFile = path.join(REMEDIATION_DIR, `step${s}-tasks.json`);
  if (!fs.existsSync(tasksFile)) {
    process.stdout.write(`  step ${s}: (no tasks file — run \`discover.mjs --step ${s}\`)\n`);
    continue;
  }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(tasksFile, 'utf8')); }
  catch (e) { process.stdout.write(`  step ${s}: MALFORMED (${e.message})\n`); continue; }
  const counts = { pending: 0, dispatched: 0, applied: 0, rejected: 0, escalated: 0 };
  for (const t of doc.tasks ?? []) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const total = (doc.tasks ?? []).length;
  process.stdout.write(
    `  step ${s}: ${total} total · ` +
    `pending=${counts.pending} dispatched=${counts.dispatched} applied=${counts.applied} ` +
    `rejected=${counts.rejected} escalated=${counts.escalated}\n`,
  );
}

// Recent log entries
const logPath = path.join(REMEDIATION_DIR, 'log.md');
if (fs.existsSync(logPath)) {
  const lines = fs.readFileSync(logPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('- '));
  if (lines.length > 0) {
    process.stdout.write(`\nLast ${Math.min(5, lines.length)} log entries:\n`);
    for (const l of lines.slice(0, 5)) process.stdout.write(`  ${l.slice(2)}\n`);
  }
}

// Top participants
const sorted = [...overlaps.byFeature.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
if (sorted.length > 0) {
  process.stdout.write(`\nTop ${sorted.length} features by overlap participation:\n`);
  const w = Math.max(...sorted.map(([id]) => id.length));
  for (const [id, n] of sorted) {
    process.stdout.write(`  ${String(n).padStart(3)}  ${id.padEnd(w)}\n`);
  }
}

if (FINAL || VERBOSE) {
  process.stdout.write(`\nPer-file overlaps (${overlaps.byFile.length}):\n`);
  for (const { file, claimedBy } of overlaps.byFile) {
    process.stdout.write(`  ${file}\n    ${claimedBy.join(', ')}\n`);
  }
}

process.stdout.write('\n');
process.exit(0);
