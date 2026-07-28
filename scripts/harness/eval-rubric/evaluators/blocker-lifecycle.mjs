/**
 * Blocker lifecycle evaluator.
 *
 * Purpose:
 * - Score status hygiene when blockers are cleared.
 * - Reward blocked->in-progress transition; penalize stale blocked status.
 *
 * Input contract:
 * - Reads blockers[] and status in before/after snapshots.
 */
import { createEval } from '../lib/result.mjs';

function blockers(feature) {
  return Array.isArray(feature?.blockers) ? feature.blockers : [];
}

export function evaluateBlockerLifecycle(beforeFeature, afterFeature) {
  const beforeBlockers = blockers(beforeFeature);
  const afterBlockers = blockers(afterFeature);
  const beforeStatus = beforeFeature?.status ?? 'planned';
  const afterStatus = afterFeature?.status ?? 'planned';
  const featureId = afterFeature?.id ?? beforeFeature?.id ?? 'unknown';

  if (beforeBlockers.length === 0 || afterBlockers.length > 0) {
    return [];
  }

  if (beforeStatus === 'blocked' && afterStatus === 'in-progress') {
    return [
      createEval({
        featureId,
        category: 'blocker-lifecycle',
        decision: 'blocker_resolution',
        reason: 'blocker_cleared_transition_correct',
        reward: 0.7,
        evidence: { previousBlockers: beforeBlockers },
        context: { beforeStatus, afterStatus },
      }),
    ];
  }

  if (beforeStatus === 'blocked' && afterStatus === 'blocked') {
    return [
      createEval({
        featureId,
        category: 'blocker-lifecycle',
        decision: 'blocker_resolution',
        reason: 'blocker_cleared_but_status_not_updated',
        reward: -0.2,
        evidence: { previousBlockers: beforeBlockers },
        context: { beforeStatus, afterStatus },
      }),
    ];
  }

  return [];
}
