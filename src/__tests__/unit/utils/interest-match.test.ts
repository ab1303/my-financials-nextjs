import { describe, expect, it } from 'vitest';

import {
  scoreInterestMatch,
  tokenSetRatio,
} from '../../../server/utils/interest-match';

describe('tokenSetRatio', () => {
  it('should return 1 for identical strings', () => {
    expect(tokenSetRatio('Credit Interest', 'Credit Interest')).toBe(1);
  });

  it('should return 0 for completely different strings', () => {
    expect(tokenSetRatio('abc', 'def')).toBe(0);
  });

  it('should handle partial overlap', () => {
    const score = tokenSetRatio('Credit Interest', 'Interest Payment');
    // tokens: [credit, interest] vs [interest, payment]
    // intersection: [interest] (size 1)
    // total size: 2 + 2 = 4
    // Dice: 2 * 1 / 4 = 0.5
    expect(score).toBe(0.5);
  });
});

describe('scoreInterestMatch', () => {
  const credit = {
    id: 'c1',
    amount: 100,
    date: new Date('2025-01-01'),
    description: 'Credit Interest',
  };

  it('should return 1.0 for perfect match', () => {
    const evidence = { ...credit };
    const score = scoreInterestMatch(credit, evidence);
    // (1.0 * 0.4) + (1.0 * 0.2) + (1.0 * 0.2) = 0.8
    // Normalized: 0.8 / 0.8 = 1.0
    expect(score).toBe(1);
  });

  it('should penalize date difference', () => {
    const evidence = {
      ...credit,
      date: new Date('2025-01-31'), // 30 days diff
    };
    const score = scoreInterestMatch(credit, evidence);
    // Date score: 1 - 30/90 = 0.666...
    // Total: (1.0 * 0.4) + (0.666 * 0.2) + (1.0 * 0.2) = 0.4 + 0.1333 + 0.2 = 0.7333
    // Normalized: 0.7333 / 0.8 = 0.9166...
    expect(score).toBeCloseTo(0.9167, 3);
  });

  it('should penalize amount difference', () => {
    const evidence = {
      ...credit,
      amount: 50, // 50% diff
    };
    const score = scoreInterestMatch(credit, evidence);
    // Amount score: 1 - 50/100 = 0.5
    // Total: (0.5 * 0.4) + (1.0 * 0.2) + (1.0 * 0.2) = 0.2 + 0.2 + 0.2 = 0.6
    // Normalized: 0.6 / 0.8 = 0.75
    expect(score).toBeCloseTo(0.75, 5);
  });
});
