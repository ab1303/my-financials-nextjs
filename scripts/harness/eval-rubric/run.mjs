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
const DEFAULT_OUTPUT_PATHS = {
  evalStateDir: EVAL_STATE_DIR,
  trainingDataPath: TRAINING_DATA_PATH,
  summaryPath: SUMMARY_PATH,
  snapshotPath: SNAPSHOT_PATH,
};

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

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeTextIfChanged(filePath, contents) {
  const existing = safeReadText(filePath);
  if (existing === contents) {
    return false;
  }

  fs.writeFileSync(filePath, contents, 'utf8');
  return true;
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

function buildEvalArtifacts(current, previous = null) {
  if (!Array.isArray(current.features)) {
    throw new Error('feature-status.json is malformed: expected features[]');
  }

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

  return { evalResults, jsonl, summary, summaryText };
}

function ensureStateDir(paths = DEFAULT_OUTPUT_PATHS) {
  if (!fs.existsSync(paths.evalStateDir)) {
    fs.mkdirSync(paths.evalStateDir, { recursive: true });
  }
}

function buildExplainLines(evalResults) {
  return [...evalResults]
    .sort((a, b) => `${a.featureId}:${a.category}:${a.reason}`.localeCompare(`${b.featureId}:${b.category}:${b.reason}`))
    .map(
      result =>
        `- [${result.category}] ${result.featureId} :: ${result.reason} => ${result.reward.toFixed(2)}`
    )
    .join('\n');
}

function parseTrainingDataJsonl(contents) {
  return contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function readCachedArtifacts() {
  const summaryText = safeReadText(SUMMARY_PATH);
  const trainingDataText = safeReadText(TRAINING_DATA_PATH);
  if (!summaryText || !trainingDataText) {
    return null;
  }

  try {
    const summary = JSON.parse(summaryText);
    const evalResults = parseTrainingDataJsonl(trainingDataText);
    const jsonl = trainingDataText.replace(/\r?\n$/, '');

    return {
      evalResults,
      jsonl,
      summary,
      summaryText: formatSummary(summary),
    };
  } catch {
    return null;
  }
}

function writeEvalOutputs({ current, jsonl, summary, paths = DEFAULT_OUTPUT_PATHS }) {
  ensureStateDir(paths);

  return {
    trainingData: writeTextIfChanged(paths.trainingDataPath, `${jsonl}\n`),
    summary: writeTextIfChanged(paths.summaryPath, `${JSON.stringify(summary, null, 2)}\n`),
    snapshot: writeTextIfChanged(paths.snapshotPath, `${JSON.stringify(current, null, 2)}\n`),
  };
}

function runEvalRubric({ dryRun = false, jsonOut = false, explain = false } = {}) {
  if (!fs.existsSync(FEATURE_STATUS_PATH)) {
    throw new Error('.harness/feature-status.json not found');
  }

  const current = readJson(FEATURE_STATUS_PATH);
  const previous = safeReadJson(SNAPSHOT_PATH);
  const snapshotMatchesCurrent = previous != null && JSON.stringify(previous) === JSON.stringify(current);
  const cachedArtifacts = !dryRun && snapshotMatchesCurrent ? readCachedArtifacts() : null;
  const artifacts = cachedArtifacts ?? buildEvalArtifacts(current, previous);

  if (!dryRun && !cachedArtifacts) {
    writeEvalOutputs({ current, ...artifacts });
  }

  if (jsonOut) {
    return {
      ok: true,
      dryRun,
      outputs: {
        trainingDataPath: '.harness/training-data.jsonl',
        summaryPath: '.harness/eval-summary.json',
        snapshotPath: '.harness/eval-rubric/last-feature-status.json',
      },
      summary: artifacts.summary,
      explain: explain ? artifacts.evalResults : undefined,
    };
  }

  let stdout = `${artifacts.summaryText}\n`;
  if (explain) {
    stdout += 'explain:\n';
    stdout += `${buildExplainLines(artifacts.evalResults) || '- (none)'}\n`;
  }
  stdout += dryRun
    ? 'dry-run: outputs were not written.\n'
    : 'wrote .harness/training-data.jsonl and eval-rubric state.\n';

  return { ok: true, dryRun, stdout, summary: artifacts.summary, evalResults: artifacts.evalResults };
}

function main() {
  const result = runEvalRubric({ dryRun: DRY_RUN, jsonOut: JSON_OUT, explain: EXPLAIN });

  if (JSON_OUT) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(result.stdout);
  }
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_MAIN) {
  try {
    main();
    process.exit(0);
  } catch (error) {
    process.stderr.write(`eval-rubric failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

export {
  buildEvalArtifacts,
  buildExplainLines,
  runEvalRubric,
  writeEvalOutputs,
};
