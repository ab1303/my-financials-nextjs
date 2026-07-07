/**
 * Human-readable and machine-readable eval summaries.
 *
 * Purpose:
 * - Provide quick explainability for engineers during rubric changes.
 * - Surface category/reason/feature concentration and negative hotspots.
 */
export function summarizeEvals(evalResults) {
  const totals = {
    count: evalResults.length,
    positive: 0,
    negative: 0,
    neutral: 0,
    rewardSum: 0,
  };

  for (const result of evalResults) {
    totals.rewardSum += result.reward;
    if (result.reward > 0) totals.positive += 1;
    else if (result.reward < 0) totals.negative += 1;
    else totals.neutral += 1;
  }

  const averageReward = totals.count > 0 ? totals.rewardSum / totals.count : 0;

  const byCategory = evalResults.reduce((acc, result) => {
    acc[result.category] = (acc[result.category] ?? 0) + 1;
    return acc;
  }, {});

  const byReason = evalResults.reduce((acc, result) => {
    acc[result.reason] = (acc[result.reason] ?? 0) + 1;
    return acc;
  }, {});

  const byFeature = evalResults.reduce((acc, result) => {
    acc[result.featureId] = (acc[result.featureId] ?? 0) + 1;
    return acc;
  }, {});

  const negativeByReason = evalResults
    .filter(result => result.reward < 0)
    .reduce((acc, result) => {
      acc[result.reason] = (acc[result.reason] ?? 0) + 1;
      return acc;
    }, {});

  const topNegativeReasons = Object.entries(negativeByReason)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  return {
    ...totals,
    averageReward,
    byCategory,
    byReason,
    byFeature,
    topNegativeReasons,
  };
}

export function formatSummary(summary) {
  const categoryRows = Object.entries(summary.byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, count]) => `- ${category}: ${count}`)
    .join('\n');

  const reasonRows = Object.entries(summary.byReason ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reason, count]) => `- ${reason}: ${count}`)
    .join('\n');

  const topNegativeRows = (summary.topNegativeReasons ?? [])
    .map(item => `- ${item.reason}: ${item.count}`)
    .join('\n');

  return [
    'eval-rubric summary',
    `total: ${summary.count}`,
    `positive: ${summary.positive}`,
    `negative: ${summary.negative}`,
    `neutral: ${summary.neutral}`,
    `average reward: ${summary.averageReward.toFixed(4)}`,
    'by category:',
    categoryRows || '- (none)',
    'by reason:',
    reasonRows || '- (none)',
    'top negative reasons:',
    topNegativeRows || '- (none)',
  ].join('\n');
}
