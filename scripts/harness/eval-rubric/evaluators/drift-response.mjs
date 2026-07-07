/**
 * Drift response evaluator.
 *
 * Purpose:
 * - Detect whether non-zero spec drift is accompanied by an explicit
 *   decision token in feature notes.
 * - Treat silent drift as a penalty.
 *
 * Input contract:
 * - Reads spec-check evidence result string and notes text.
 */
import { createEval } from '../lib/result.mjs';

const DRIFT_DECISIONS = ['drift:defer', 'drift:fixed', 'drift:escalate'];

function parseDriftCount(feature) {
  const specCheckEvidence = (feature.evidence ?? []).find(item => item?.id === 'spec-check');
  const result = typeof specCheckEvidence?.result === 'string' ? specCheckEvidence.result : '';
  const match = result.match(/drift=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function evaluateDriftResponse(_beforeFeature, afterFeature) {
  const driftCount = parseDriftCount(afterFeature);
  if (driftCount == null || driftCount <= 0) {
    return [];
  }

  const notes = typeof afterFeature.notes === 'string' ? afterFeature.notes : '';
  const documented = DRIFT_DECISIONS.some(token => notes.includes(token));

  return [
    createEval({
      featureId: afterFeature.id,
      category: 'drift-response',
      decision: 'drift_response',
      reason: documented ? 'drift_decision_documented' : 'drift_response_missing',
      reward: documented ? 0.5 : -0.4,
      evidence: documented ? { decision: notes } : { decision: null },
      context: { driftCount },
    }),
  ];
}
