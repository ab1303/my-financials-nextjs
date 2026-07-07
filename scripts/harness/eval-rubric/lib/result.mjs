/**
 * Shared eval result helpers.
 *
 * Purpose:
 * - Normalize reward bounds to the rubric's [-1.0, 1.0] contract.
 * - Keep result object construction uniform across evaluators.
 */
export function clampReward(value) {
  if (Number.isNaN(value)) return 0;
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}

export function createEval({
  featureId,
  category,
  decision,
  reason,
  reward,
  evidence = {},
  context = {},
}) {
  return {
    featureId,
    category,
    decision,
    reason,
    reward: clampReward(reward),
    evidence,
    context,
  };
}
