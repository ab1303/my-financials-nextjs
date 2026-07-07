#!/usr/bin/env node
/**
 * Eval-rubric orchestrator.
 *
 * Purpose:
 * - Compare previous and current feature-status snapshots.
 * - Run deterministic evaluators.
 * - Emit machine-readable training data + explainable summary.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateBlockerLifecycle } from './evaluators/blocker-lifecycle.mjs';
import { evaluateDriftResponse } from './evaluators/drift-response.mjs';
import { evaluateEvidenceRecording } from './evaluators/evidence-recording.mjs';
import { evaluateStatusTransitions } from './evaluators/status-transitions.mjs';
import { evaluateVerificationGates } from './evaluators/verification-gates.mjs';
import { toTrainingDataJsonl } from './output-formatters/training-data.mjs';
import { formatSummary, summarizeEvals } from './reporters/eval-summary.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HARNESS_DIR = path.join(REPO_ROOT, '.harness');
const EVAL_STATE_DIR = path.join(HARNESS_DIR, 'eval-rubric');
const FEATURE_STATUS_PATH = path.join(HARNESS_DIR, 'feature-status.json');
const SNAPSHOT_PATH = path.join(EVAL_STATE_DIR, 'last-feature-status.json');
const TRAINING_DATA_PATH = path.join(HARNESS_DIR, 'training-data.jsonl');
const SUMMARY_PATH = path.join(HARNESS_DIR, 'eval-summary.json');

const DRY_RUN = process.argv.includes('--dry-run');
const JSON_OUT = process.argv.includes('--json');
const EXPLAIN = process.argv.includes('--explain');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function featureMap(features) {
  return new Map(features.map(feature => [feature.id, feature]));
}

function stableFeatureSort(a, b) {
  return String(a.id).localeCompare(String(b.id));
}

function evalTimestamp(afterFeature, statusUpdatedAt) {
  return afterFeature.completedAt ?? statusUpdatedAt ?? null;
}

function evaluateFeature(beforeFeature, afterFeature, statusUpdatedAt) {
  const baseContext = { timestamp: evalTimestamp(afterFeature, statusUpdatedAt) };
  const appendTimestamp = result => ({
    ...result,
    context: { ...result.context, ...baseContext },
  });

  return [
    ...evaluateStatusTransitions(beforeFeature, afterFeature).map(appendTimestamp),
    ...evaluateEvidenceRecording(beforeFeature, afterFeature).map(appendTimestamp),
    ...evaluateVerificationGates(beforeFeature, afterFeature).map(appendTimestamp),
    ...evaluateBlockerLifecycle(beforeFeature, afterFeature).map(appendTimestamp),
    ...evaluateDriftResponse(beforeFeature, afterFeature).map(appendTimestamp),
  ];
}

function ensureStateDir() {
  if (!fs.existsSync(EVAL_STATE_DIR)) {
    fs.mkdirSync(EVAL_STATE_DIR, { recursive: true });
  }
}

function main() {
  if (!fs.existsSync(FEATURE_STATUS_PATH)) {
    throw new Error('.harness/feature-status.json not found');
  }

  const current = readJson(FEATURE_STATUS_PATH);
  if (!Array.isArray(current.features)) {
    throw new Error('feature-status.json is malformed: expected features[]');
  }

  const previous = safeReadJson(SNAPSHOT_PATH);
  const previousFeatures = Array.isArray(previous?.features) ? previous.features : [];
  const previousById = featureMap(previousFeatures);

  const orderedFeatures = [...current.features].sort(stableFeatureSort);
  const evalResults = [];

  for (const afterFeature of orderedFeatures) {
    const beforeFeature = previousById.get(afterFeature.id) ?? {
      id: afterFeature.id,
      status: afterFeature.status,
      verification: [],
      evidence: [],
      blockers: afterFeature.blockers ?? [],
      notes: '',
    };

    evalResults.push(...evaluateFeature(beforeFeature, afterFeature, current.updatedAt));
  }

  const jsonl = toTrainingDataJsonl(evalResults, current.updatedAt);
  const summary = summarizeEvals(evalResults);
  const summaryText = formatSummary(summary);

  if (!DRY_RUN) {
    ensureStateDir();
    fs.writeFileSync(TRAINING_DATA_PATH, `${jsonl}\n`, 'utf8');
    fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  }

  if (JSON_OUT) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          dryRun: DRY_RUN,
          outputs: {
            trainingDataPath: '.harness/training-data.jsonl',
            summaryPath: '.harness/eval-summary.json',
            snapshotPath: '.harness/eval-rubric/last-feature-status.json',
          },
          summary,
          explain: EXPLAIN ? evalResults : undefined,
        },
        null,
        2
      )}\n`
    );
  } else {
    process.stdout.write(`${summaryText}\n`);
    if (EXPLAIN) {
      const explainLines = [...evalResults]
        .sort((a, b) => `${a.featureId}:${a.category}:${a.reason}`.localeCompare(`${b.featureId}:${b.category}:${b.reason}`))
        .map(
          result =>
            `- [${result.category}] ${result.featureId} :: ${result.reason} => ${result.reward.toFixed(2)}`
        )
        .join('\n');
      process.stdout.write('explain:\n');
      process.stdout.write(`${explainLines || '- (none)'}\n`);
    }
    if (DRY_RUN) {
      process.stdout.write('dry-run: outputs were not written.\n');
    } else {
      process.stdout.write('wrote .harness/training-data.jsonl and eval-rubric state.\n');
    }
  }
}

try {
  main();
  process.exit(0);
} catch (error) {
  process.stderr.write(`eval-rubric failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
