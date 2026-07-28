/**
 * Status transition evaluator.
 *
 * Purpose:
 * - Score lifecycle correctness for feature status changes.
 * - Reward legitimate completion and incremental in-progress progress.
 * - Penalize premature "done" transitions with failing verification.
 *
 * Input contract:
 * - beforeFeature / afterFeature objects from feature-status snapshots.
 * - Reads: status, verification[].passing.
 */
import { createEval } from '../lib/result.mjs';

function verificationItems(feature) {
  return Array.isArray(feature?.verification) ? feature.verification : [];
}

function passingCount(feature) {
  return verificationItems(feature).filter(item => item?.passing === true).length;
}

function allPassing(feature) {
  const verification = verificationItems(feature);
  return verification.length > 0 && verification.every(item => item?.passing === true);
}

export function evaluateStatusTransitions(beforeFeature, afterFeature) {
  const evals = [];
  const beforeStatus = beforeFeature?.status ?? 'planned';
  const afterStatus = afterFeature?.status ?? 'planned';
  const featureId = afterFeature?.id ?? beforeFeature?.id ?? 'unknown';

  if (beforeStatus === 'in-progress' && afterStatus === 'done') {
    if (allPassing(afterFeature)) {
      evals.push(
        createEval({
          featureId,
          category: 'status-transitions',
          decision: 'status_transition',
          reason: 'correct_transition_all_gates_cleared',
          reward: 1.0,
          evidence: { verificationCount: verificationItems(afterFeature).length },
          context: { beforeStatus, afterStatus },
        })
      );
    } else {
      const failing = verificationItems(afterFeature)
        .filter(item => item?.passing !== true)
        .map(item => item?.id)
        .filter(Boolean);
      evals.push(
        createEval({
          featureId,
          category: 'status-transitions',
          decision: 'status_transition',
          reason: 'premature_transition',
          reward: -1.0,
          evidence: { failingVerificationIds: failing },
          context: { beforeStatus, afterStatus },
        })
      );
    }
  }

  if (beforeStatus === 'in-progress' && afterStatus === 'in-progress') {
    const delta = passingCount(afterFeature) - passingCount(beforeFeature ?? {});
    if (delta > 0) {
      evals.push(
        createEval({
          featureId,
          category: 'status-transitions',
          decision: 'status_transition',
          reason: 'incremental_progress',
          reward: 0.3 * delta,
          evidence: { checksCompleted: delta },
          context: { beforeStatus, afterStatus },
        })
      );
    }
  }

  return evals;
}
