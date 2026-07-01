#!/usr/bin/env node
/**
 * close.mjs — automates the deterministic portion of the session-end ritual.
 *
 * Usage: node scripts/harness/session-close/close.mjs [--feature <id>] [--dry-run]
 *
 * Algorithm:
 *   1. Detect active feature from .harness/feature-status.json
 *   2. Run Verification Gate (type-check, lint, spec-check)
 *   3. Update feature-status.json (verification[] passing + evidence[])
 *   4. Rotate progress.md → progress-history.md if feature just became done
 *   5. Stamp lastVerifiedSha in spec/index.json
 *   6. Print diff-style summary
 *   7. Stage harness files (never git commit)
 *
 * Exit codes:
 *   0 — all gates pass
 *   1 — one or more gates fail (feature stays in-progress)
 *   2 — feature-status.json missing or malformed
 *   3 — no active feature found
 *
 * Idempotency: running twice with no intervening changes produces the same output.
 * Evidence entries are overwritten by id; progress-history.md only prepended once per entry.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const featureFlagIdx = args.indexOf('--feature');
const FEATURE_OVERRIDE = featureFlagIdx !== -1 ? (args[featureFlagIdx + 1] ?? null) : null;

const PATHS = {
  featureStatus: path.join(REPO_ROOT, '.harness', 'feature-status.json'),
  progress: path.join(REPO_ROOT, '.harness', 'progress.md'),
  progressHistory: path.join(REPO_ROOT, '.harness', 'progress-history.md'),
  specIndex: path.join(REPO_ROOT, 'spec', 'index.json'),
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function die(code, msg) {
  console.error(`\n❌ close.mjs: ${msg}`);
  process.exit(code);
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getHeadSha() {
  const res = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return res.stdout?.trim() ?? 'unknown';
}

function tailLines(str, n = 3) {
  const lines = (str ?? '').trim().split('\n').filter(l => l.trim());
  return lines.slice(-n).join(' | ') || '(no output)';
}

/** Run a single gate command, return { passing, tail, exitCode, rawOutput }. */
function runGate(label, cmd, cmdArgs) {
  console.log(`\n▶ Running ${label}...`);
  const result = spawnSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 10 * 1024 * 1024,
  });
  const rawOutput = ((result.stdout ?? '') + (result.stderr ?? '')).trim();
  const passing = result.status === 0;
  const icon = passing ? '✅' : '❌';
  console.log(`${icon} ${label}: ${passing ? 'PASSED' : `FAILED (exit ${result.status})`}`);
  if (!passing && rawOutput) {
    console.log(rawOutput.split('\n').slice(-10).join('\n'));
  }
  return { passing, exitCode: result.status ?? 1, rawOutput };
}

/** Extract spec-check summary line from raw output. */
function extractSpecCheckSummary(rawOutput, passing) {
  const m = rawOutput.match(/Totals:\s*(drift=\d+\s+overlap=\d+\s+ghost=\d+(?:\s+sha-missing=\d+)?(?:\s+review=\d+)?)/);
  if (m) return m[1].trim();
  return passing ? 'exit 0' : `exit 1`;
}

/** Build the evidence result string for a gate. */
function buildResult(gateKey, gateResult) {
  if (gateKey === 'spec-check') {
    return extractSpecCheckSummary(gateResult.rawOutput, gateResult.passing);
  }
  if (gateResult.passing) {
    // Filter out pnpm boilerplate lines ("> script-name" and "> command")
    const meaningfulLines = (gateResult.rawOutput ?? '')
      .split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('>') && !l.trim().startsWith('WARN'))
      .slice(-3);
    return meaningfulLines.length > 0
      ? `exit 0, ${meaningfulLines.join(' | ')}`
      : 'exit 0, no output';
  }
  return `exit ${gateResult.exitCode}, ${tailLines(gateResult.rawOutput, 3)}`;
}

// ── 1. Load feature-status.json ──────────────────────────────────────────────

const statusData = readJSON(PATHS.featureStatus);
if (!statusData || !Array.isArray(statusData.features)) {
  die(2, 'feature-status.json missing or malformed');
}

// ── 2. Detect active feature ─────────────────────────────────────────────────

let feature;
if (FEATURE_OVERRIDE) {
  feature = statusData.features.find(f => f.id === FEATURE_OVERRIDE);
  if (!feature) die(3, `Feature '${FEATURE_OVERRIDE}' not found in feature-status.json`);
} else {
  feature = statusData.features.find(f => f.status === 'in-progress');
  if (!feature) {
    die(3, 'No in-progress feature found in feature-status.json. Use --feature <id> to specify one.');
  }
}

console.log(`\n🔍 Active feature: ${feature.id} (${feature.status})`);
if (DRY_RUN) console.log('🔸 DRY RUN — no files will be written\n');

// ── 3. Run Verification Gate ─────────────────────────────────────────────────

const sha = getHeadSha();

const gateResults = {
  'type-check': runGate('pnpm run type-check', 'pnpm', ['run', 'type-check']),
  'lint': runGate('pnpm run lint', 'pnpm', ['run', 'lint']),
  'spec-check': runGate('pnpm spec:check', 'node', [
    'scripts/harness/spec-manifest/spec-check.mjs',
  ]),
};

// ── 4. Update feature-status.json ───────────────────────────────────────────

const GATE_IDS = ['type-check', 'lint', 'spec-check'];
const GATE_COMMANDS = {
  'type-check': 'pnpm run type-check',
  'lint': 'pnpm run lint',
  'spec-check': 'node scripts/harness/spec-manifest/spec-check.mjs',
};

for (const gateId of GATE_IDS) {
  // Update verification[] if the item exists
  const verItem = feature.verification?.find(v => v.id === gateId);
  if (verItem) {
    verItem.passing = gateResults[gateId].passing;
  }

  // Upsert evidence[] (overwrite by id — idempotent)
  if (!feature.evidence) feature.evidence = [];
  const evidenceIdx = feature.evidence.findIndex(e => e.id === gateId);
  const evidenceEntry = {
    id: gateId,
    sha,
    command: GATE_COMMANDS[gateId],
    result: buildResult(gateId, gateResults[gateId]),
  };
  if (evidenceIdx !== -1) {
    feature.evidence[evidenceIdx] = evidenceEntry;
  } else {
    feature.evidence.push(evidenceEntry);
  }
}

// Determine if the feature just became done
const allVerificationPass = (feature.verification?.length ?? 0) > 0
  && feature.verification.every(v => v.passing === true);
const wasInProgress = feature.status === 'in-progress';
const justCompleted = allVerificationPass && wasInProgress;

if (justCompleted) {
  feature.status = 'done';
  feature.completedAt = new Date().toISOString().slice(0, 10);
  console.log(`\n🎉 All verification items passing — feature '${feature.id}' marked DONE`);
} else {
  const stillFailing = feature.verification?.filter(v => !v.passing).map(v => v.id) ?? [];
  if (stillFailing.length > 0) {
    console.log(`\n⚠️  Verification items still failing: ${stillFailing.join(', ')}`);
  }
}

statusData.updatedAt = new Date().toISOString();

// ── 5. Build progress.md content ─────────────────────────────────────────────

const isoDate = new Date().toISOString().slice(0, 10);
const statusLabel = (justCompleted || feature.status === 'done') ? 'COMPLETE ✅' : 'IN PROGRESS';

const typeCheckRow = `| \`pnpm run type-check\` | ${gateResults['type-check'].passing ? '✅' : '❌'} ${buildResult('type-check', gateResults['type-check'])} |`;
const lintRow = `| \`pnpm run lint\` | ${gateResults['lint'].passing ? '✅' : '❌'} ${buildResult('lint', gateResults['lint'])} |`;
const specCheckRow = `| \`pnpm spec:check\` | ${gateResults['spec-check'].passing ? '✅' : '❌'} ${extractSpecCheckSummary(gateResults['spec-check'].rawOutput, gateResults['spec-check'].passing)} |`;

const openItemsList = (() => {
  const failing = feature.verification?.filter(v => !v.passing) ?? [];
  if (failing.length === 0) return 'None — all verification items passing';
  return failing.map(v => `- [ ] \`${v.id}\`: ${v.description ?? v.id}`).join('\n');
})();

const plannedList = (() => {
  const others = statusData.features.filter(
    f => (f.status === 'planned' || (f.status === 'in-progress' && f.id !== feature.id))
  );
  if (others.length === 0) return '_No other planned or in-progress features._';
  return others.map(f => `- \`${f.id}\` (${f.status})`).join('\n');
})();

const progressContent = `# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to \`progress-history.md\`.
Agents: read this file at session start to know exactly what to work on next.

---

## ${isoDate} — ${feature.id} — ${statusLabel}

### Verification gate (auto-stamped by close.mjs @ ${sha})

| Check | Result |
|---|---|
${typeCheckRow}
${lintRow}
${specCheckRow}

### What was done
<!-- close.mjs: populated from feature-status.json notes field -->
${feature.notes ?? '_No notes._'}

### Open verification items
<!-- close.mjs: list verification[].passing===false, or "None — feature complete" -->
${openItemsList}

### Next up
<!-- Agent: replace this block with narrative + chosen workstream -->
<!-- Planned features from feature-status.json with status:"planned" or "in-progress": -->
${plannedList}

### Next session starts at
<!-- Agent: fill in the specific file + section or command to resume from -->
`;

// ── 6. Rotate progress.md → progress-history.md (if just completed) ──────────

const writtenFiles = [];

if (justCompleted) {
  let historyContent = fs.existsSync(PATHS.progressHistory)
    ? fs.readFileSync(PATHS.progressHistory, 'utf8')
    : '# Harness Progress — Completed Session Archive\n\nEntries moved here when no longer the active handoff. Newest first.\nRead only for archaeology; do not use to orient a new session.\n\n---\n';

  // Idempotency: only prepend if not already in history
  const entryMarker = `## ${isoDate} — ${feature.id}`;
  const alreadyInHistory = historyContent.includes(entryMarker);

  if (!alreadyInHistory && fs.existsSync(PATHS.progress)) {
    const existing = fs.readFileSync(PATHS.progress, 'utf8');
    // Extract the ## section onwards (skip the file header)
    const firstH2 = existing.indexOf('\n## ');
    const entryContent = firstH2 !== -1 ? existing.slice(firstH2 + 1).trim() : '';

    if (entryContent) {
      const separatorIdx = historyContent.indexOf('\n---\n');
      if (separatorIdx !== -1) {
        historyContent =
          historyContent.slice(0, separatorIdx + 5) +
          entryContent +
          '\n\n---\n' +
          historyContent.slice(separatorIdx + 5);
      } else {
        historyContent += '\n---\n' + entryContent + '\n';
      }
      if (!DRY_RUN) fs.writeFileSync(PATHS.progressHistory, historyContent, 'utf8');
      writtenFiles.push({ file: '.harness/progress-history.md', action: 'prepended completed entry' });
    }
  } else if (alreadyInHistory) {
    writtenFiles.push({ file: '.harness/progress-history.md', action: 'already contains this entry (idempotent — skipped)' });
  }
}

// ── 7. Stamp lastVerifiedSha in spec/index.json ───────────────────────────────

const specIndex = readJSON(PATHS.specIndex);
if (specIndex?.features) {
  const specFeature = specIndex.features.find(f => f.id === feature.id);
  if (specFeature) {
    specFeature.lastVerifiedSha = sha;
    specFeature.lastVerifiedDate = isoDate;
    if (!DRY_RUN) writeJSON(PATHS.specIndex, specIndex);
    writtenFiles.push({ file: 'spec/index.json', action: `stamped lastVerifiedSha=${sha} for ${feature.id}` });
  } else {
    writtenFiles.push({ file: 'spec/index.json', action: `⚠ feature '${feature.id}' not found in index — skipped` });
  }
}

// ── 8. Write feature-status.json ─────────────────────────────────────────────

if (!DRY_RUN) writeJSON(PATHS.featureStatus, statusData);
writtenFiles.push({
  file: '.harness/feature-status.json',
  action: `updated verification + evidence for ${GATE_IDS.join(', ')}${justCompleted ? ' → status=done' : ''}`,
});

// ── 9. Write progress.md ──────────────────────────────────────────────────────

if (!DRY_RUN) fs.writeFileSync(PATHS.progress, progressContent, 'utf8');
writtenFiles.push({ file: '.harness/progress.md', action: `written (${statusLabel})` });

// ── 10. Print diff-style summary ─────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────');
console.log('📋 Files written:');
for (const { file, action } of writtenFiles) {
  console.log(`  ✅ ${file} — ${action}`);
}

console.log('\n📊 Verification gate:');
for (const [id, res] of Object.entries(gateResults)) {
  console.log(`  ${res.passing ? '✅' : '❌'} ${id.padEnd(12)} ${res.passing ? 'PASS' : `FAIL (exit ${res.exitCode})`}`);
}

if (DRY_RUN) {
  console.log('\n🔸 DRY RUN — no files were written.');
}

// ── 11. Stage harness files (never git commit) ────────────────────────────────

if (!DRY_RUN) {
  const toStage = [
    '.harness/feature-status.json',
    '.harness/progress.md',
    ...(justCompleted ? ['.harness/progress-history.md'] : []),
    'spec/index.json',
  ];
  spawnSync('git', ['add', ...toStage], { cwd: REPO_ROOT, stdio: 'inherit' });
  console.log('\n📌 Harness files staged.');
}

console.log(
  `\n💬 Review the <!-- narrative --> block in .harness/progress.md, then commit:\n`
);
console.log(
  `   git commit -m "harness: session close ${isoDate} — ${feature.id} (${statusLabel})"\n`
);

// ── Exit code ────────────────────────────────────────────────────────────────

const allGatesPass = Object.values(gateResults).every(g => g.passing);
process.exit(allGatesPass ? 0 : 1);
