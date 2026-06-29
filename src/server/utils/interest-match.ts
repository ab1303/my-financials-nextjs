import type { Decimal } from '@prisma/client/runtime/library';
import { differenceInDays } from 'date-fns';

/**
 * Calculates a similarity score between two strings based on token overlap.
 * Returns a value between 0 and 1.
 */
export function tokenSetRatio(s1: string, s2: string): number {
  const tokens1 = s1
    .toLowerCase()
    .trim()
    .split(/[\s,._-]+/)
    .filter(Boolean);
  const tokens2 = s2
    .toLowerCase()
    .trim()
    .split(/[\s,._-]+/)
    .filter(Boolean);

  if (tokens1.length === 0 && tokens2.length === 0) return 1;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = [...set1].filter((token) => set2.has(token));

  // Dice coefficient / Token Set similarity
  return (2 * intersection.length) / (set1.size + set2.size);
}

export interface MatchCandidate {
  amount: number | Decimal;
  date: Date;
  description: string;
}

export interface ScoringWeights {
  amount: number;
  date: number;
  description: number;
  reference?: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  amount: 0.4,
  date: 0.2,
  description: 0.2,
  // Remaining 0.20 can be distributed or handled as custom
};

/**
 * Scores a candidate match against a credit interest transaction.
 */
export function scoreInterestMatch(
  credit: MatchCandidate,
  evidence: MatchCandidate,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): number {
  const creditAmount =
    typeof credit.amount === 'number' ? credit.amount : Number(credit.amount);
  const evidenceAmount =
    typeof evidence.amount === 'number'
      ? evidence.amount
      : Number(evidence.amount);

  // 1. Amount Proximity (0.40)
  // 1 - (abs(credit.amount - evidence.amount) / max(credit.amount, evidence.amount))
  const maxAmount = Math.max(Math.abs(creditAmount), Math.abs(evidenceAmount));
  const amountScore =
    maxAmount === 0
      ? 1
      : 1 -
        Math.abs(Math.abs(creditAmount) - Math.abs(evidenceAmount)) / maxAmount;

  // 2. Date Proximity (0.20)
  // 1 - (days_between / 90) clipped to [0,1]
  const daysDiff = Math.abs(differenceInDays(credit.date, evidence.date));
  const dateScore = Math.max(0, 1 - daysDiff / 90);

  // 3. Description Similarity (0.20)
  const descScore = tokenSetRatio(credit.description, evidence.description);

  // Weighted sum
  // For now we only have 0.80 weight total if we use defaults.
  // We'll normalize to 1.0 or use the full 0.20 remaining for something else.
  // The LLD had: Amount(0.40), Date(0.20), Desc(0.20), Ref(0.15), Historical(0.05).

  const totalWeight =
    weights.amount +
    weights.date +
    weights.description +
    (weights.reference ?? 0);

  const score =
    amountScore * weights.amount +
    dateScore * weights.date +
    descScore * weights.description;

  // Normalize if total weight < 1
  return score / (totalWeight || 1);
}
