/**
 * JSONL formatter for RL-style training output.
 *
 * Purpose:
 * - Emit a deterministic line-per-decision artifact.
 * - Keep stable sort order to avoid noisy diffs.
 */
export function toTrainingDataJsonl(evalResults, statusUpdatedAt) {
  const ordered = [...evalResults].sort((a, b) =>
    `${a.featureId}:${a.category}:${a.reason}`.localeCompare(
      `${b.featureId}:${b.category}:${b.reason}`
    )
  );

  return ordered
    .map(result =>
      JSON.stringify({
        featureId: result.featureId,
        category: result.category,
        decision: result.decision,
        reason: result.reason,
        reward: result.reward,
        timestamp: result.context?.timestamp ?? statusUpdatedAt ?? null,
        evidence: result.evidence ?? {},
        context: result.context ?? {},
      })
    )
    .join('\n');
}
