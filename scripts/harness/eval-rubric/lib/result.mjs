/**
 * Shared eval result helpers.
 *
 * Purpose:
 * - Normalize reward bounds to the rubric's [-1.0, 1.0] contract.
 * - Keep result object construction uniform across evaluators.
 */
export function clampReward(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 1) return 1;
  if (numeric < -1) return -1;
  return numeric;
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
