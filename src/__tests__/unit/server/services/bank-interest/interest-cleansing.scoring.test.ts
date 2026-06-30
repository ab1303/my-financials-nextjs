import { describe, expect, it, vi } from 'vitest';

import { getCleansingDebitCandidates } from '@/server/services/interest-cleansing/interest-cleansing.service';

// Mock prisma
vi.mock('@/server/db/client', () => ({
  prisma: {
    transaction: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/db/client';

describe('interest-cleansing.service - scoring', () => {
  it('should compute deterministic matchPercent and contributions summing to matchPercent', async () => {
    const mockCredit = {
      id: 'credit-1',
      amount: { toNumber: () => 100 },
      date: new Date('2026-06-01'),
      description: 'Monthly Interest Payment',
    };

    const mockDebit = {
      id: 'debit-1',
      amount: 100,
      date: new Date('2026-06-01'),
      description: 'Interest Payment To Beneficiary',
      bankAccountId: 'acc-1',
      financialAccount: { name: 'Savings Account' },
      interestCleansingEvidence: [],
    };

    (prisma.transaction.findUniqueOrThrow as never).mockResolvedValue(mockCredit);
    (prisma.transaction.findMany as never).mockResolvedValue([mockDebit]);

    const candidates = await getCleansingDebitCandidates({
      userId: 'user-1',
      creditId: 'credit-1',
      bankAccountId: 'acc-1',
    });

    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;

    // Perfect match (amount, date, account). Description tokens 'monthly' vs 'to' 'beneficiary' - 'interest' and 'payment' match.
    // tokenize removes words <= 2 chars.
    // credit: ['monthly', 'interest', 'payment']
    // debit: ['interest', 'payment', 'beneficiary']
    // common: ['interest', 'payment'] (2/3 = 0.66)

    // amountScore: 1.0 (60% weight -> 60)
    // dateScore: 1.0 (10% weight -> 10)
    // descScore: 0.66 (20% weight -> 13)
    // accountScore: 1.0 (10% weight -> 10)
    // combined: 60 + 10 + 13 + 10 = 93

    expect(c.matchPercent).toBeGreaterThanOrEqual(90);
    const sum = Object.values(c.scoreBreakdown.contributionsPercent).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(c.matchPercent);
    expect(c.accountName).toBe('Savings Account');
    expect(c.reasonShort).toBe('Strong match');
  });

  it('should handle zero matches gracefully', async () => {
    const mockCredit = {
      id: 'credit-1',
      amount: { toNumber: () => 100 },
      date: new Date('2026-06-01'),
      description: 'Interest',
    };

    const mockDebit = {
      id: 'debit-1',
      amount: 1000,
      date: new Date('2026-01-01'),
      description: 'Something Else',
      bankAccountId: 'acc-2',
      financialAccount: { name: 'Other Account' },
      interestCleansingEvidence: [],
    };

    (prisma.transaction.findUniqueOrThrow as never).mockResolvedValue(mockCredit);
    (prisma.transaction.findMany as never).mockResolvedValue([mockDebit]);

    const candidates = await getCleansingDebitCandidates({
      userId: 'user-1',
      creditId: 'credit-1',
      bankAccountId: 'acc-1',
    });

    expect(candidates[0]!.matchPercent).toBeLessThan(50);
  });
});
