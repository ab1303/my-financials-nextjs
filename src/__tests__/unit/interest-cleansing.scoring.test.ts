import { describe, expect, test } from 'vitest';
// We'll need to export the scoring logic or test the service directly.
// For now, let's assume we might extract the scoring logic into a helper if it gets complex,
// but let's see how it looks in the service first.

describe('Interest Cleansing Scoring Logic', () => {
  // Mocking the scoring logic to test the rounding correction and weighting
  // Since we haven't implemented it yet, this test will serve as a spec.

  const computeScore = (
    amountScore: number,
    dateScore: number,
    descScore: number,
    accountScore: number,
    weights = { amount: 0.4, date: 0.2, desc: 0.3, account: 0.1 },
  ) => {
    const combinedNormalized = Math.max(
      0,
      Math.min(
        1,
        amountScore * weights.amount +
          dateScore * weights.date +
          descScore * weights.desc +
          accountScore * weights.account,
      ),
    );

    const matchPercent = Math.round(100 * combinedNormalized);

    const contributions = {
      amount: 0,
      date: 0,
      desc: 0,
      account: 0,
    };

    if (combinedNormalized > 0) {
      contributions.amount = Math.round(
        ((amountScore * weights.amount) / combinedNormalized) * matchPercent,
      );
      contributions.date = Math.round(
        ((dateScore * weights.date) / combinedNormalized) * matchPercent,
      );
      contributions.desc = Math.round(
        ((descScore * weights.desc) / combinedNormalized) * matchPercent,
      );
      contributions.account = Math.round(
        ((accountScore * weights.account) / combinedNormalized) * matchPercent,
      );

      // Rounding drift correction
      const currentSum = Object.values(contributions).reduce(
        (a, b) => a + b,
        0,
      );
      const diff = matchPercent - currentSum;

      if (diff !== 0) {
        // Adjust the largest contributor
        const keys = Object.keys(contributions) as Array<
          keyof typeof contributions
        >;
        const largestKey = keys.reduce((a, b) =>
          contributions[a] > contributions[b] ? a : b,
        );
        contributions[largestKey] += diff;
      }
    }

    return { matchPercent, contributions };
  };

  test('should sum contributions to matchPercent (perfect match)', () => {
    const { matchPercent, contributions } = computeScore(1, 1, 1, 1);
    expect(matchPercent).toBe(100);
    expect(
      contributions.amount +
        contributions.date +
        contributions.desc +
        contributions.account,
    ).toBe(100);
    expect(contributions).toEqual({
      amount: 40,
      date: 20,
      desc: 30,
      account: 10,
    });
  });

  test('should sum contributions to matchPercent (partial match)', () => {
    const { matchPercent, contributions } = computeScore(0.5, 0.2, 0.8, 0);
    // 0.5 * 0.4 = 0.2
    // 0.2 * 0.2 = 0.04
    // 0.8 * 0.3 = 0.24
    // 0 * 0.1 = 0
    // Total = 0.48
    // matchPercent = 48
    expect(matchPercent).toBe(48);
    expect(
      contributions.amount +
        contributions.date +
        contributions.desc +
        contributions.account,
    ).toBe(48);
  });

  test('should handle rounding drift correctly', () => {
    // Pick values that likely cause rounding issues
    const { matchPercent, contributions } = computeScore(
      0.33,
      0.33,
      0.33,
      0.33,
    );
    expect(
      contributions.amount +
        contributions.date +
        contributions.desc +
        contributions.account,
    ).toBe(matchPercent);
  });

  test('should return all zeros if combinedNormalized is 0', () => {
    const { matchPercent, contributions } = computeScore(0, 0, 0, 0);
    expect(matchPercent).toBe(0);
    expect(contributions).toEqual({ amount: 0, date: 0, desc: 0, account: 0 });
  });
});
