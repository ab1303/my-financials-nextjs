#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FEATURE_STATUS_PATH = path.join(REPO_ROOT, '.harness', 'feature-status.json');

function fail(message, details = {}) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        ...details,
      },
      null,
      2
    )
  );
  process.exit(1);
}

function readFeatureStatus() {
  try {
    const raw = fs.readFileSync(FEATURE_STATUS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    fail('Unable to read .harness/feature-status.json', {
      error: error instanceof Error ? error.message : String(error),
      path: '.harness/feature-status.json',
    });
  }
}

const status = readFeatureStatus();
if (!status || !Array.isArray(status.features)) {
  fail('feature-status.json is malformed: expected a top-level features[] array.');
}

const rules = {
  singleActiveFeature: status.rules?.singleActiveFeature === true,
  passingRequiresEvidence: status.rules?.passingRequiresEvidence === true,
};

const violations = [];

if (rules.singleActiveFeature) {
  const inProgress = status.features.filter(feature => feature?.status === 'in-progress');
  if (inProgress.length > 1) {
    violations.push({
      code: 'single-active-feature',
      message: 'At most one feature can be in-progress when singleActiveFeature=true.',
      inProgressFeatureIds: inProgress.map(feature => feature.id ?? '(missing-id)'),
    });
  }
}

for (const feature of status.features) {
  if (!feature || typeof feature !== 'object') {
    violations.push({
      code: 'malformed-feature',
      message: 'feature-status.json contains a non-object feature entry.',
    });
    continue;
  }

  const featureId = feature.id ?? '(missing-id)';
  const verifications = Array.isArray(feature.verification) ? feature.verification : [];
  const evidence = Array.isArray(feature.evidence) ? feature.evidence : [];
  const evidenceIds = new Set(
    evidence
      .map(item => item?.id)
      .filter(id => typeof id === 'string' && id.length > 0)
  );

  if (feature.status === 'done') {
    const failingVerifications = verifications
      .filter(item => item?.passing !== true)
      .map(item => item?.id ?? '(missing-id)');

    if (failingVerifications.length > 0) {
      violations.push({
        code: 'done-feature-has-failing-verification',
        featureId,
        message: 'Features with status="done" must have every verification[].passing=true.',
        failingVerificationIds: failingVerifications,
      });
    }
  }

  if (rules.passingRequiresEvidence) {
    const missingEvidence = verifications
      .filter(item => item?.passing === true)
      .map(item => item?.id)
      .filter(id => typeof id === 'string' && id.length > 0 && !evidenceIds.has(id));

    if (missingEvidence.length > 0) {
      violations.push({
        code: 'missing-evidence',
        featureId,
        message:
          'passingRequiresEvidence=true requires evidence[] entries for every passing verification item.',
        verificationIds: missingEvidence,
      });
    }
  }
}

if (violations.length > 0) {
  fail('Feature-status contract check failed.', {
    violationCount: violations.length,
    violations,
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      message: 'Feature-status contract check passed.',
      checkedFeatures: status.features.length,
    },
    null,
    2
  )
);
