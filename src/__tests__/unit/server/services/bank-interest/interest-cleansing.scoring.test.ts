import { describe, it, expect } from 'vitest';
import { getCleansingDebitCandidates } from '@/server/services/bank-interest/interest-cleansing.service';

// Mock prisma
vi.mock('@/server/utils/prisma', () => ({
  prisma: {
    transaction: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/utils/prisma';

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
      bankAccount: { name: 'Savings Account' },
    };

    (prisma.transaction.findUniqueOrThrow as any).mockResolvedValue(mockCredit);
    (prisma.transaction.findMany as any).mockResolvedValue([mockDebit]);

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
    
    // amountScore: 1.0 (40% weight -> 40)
    // dateScore: 1.0 (20% weight -> 20)
    // descScore: 0.66 (30% weight -> 20)
    // accountScore: 1.0 (10% weight -> 10)
    // combined: 40 + 20 + 20 + 10 = 90
    
    expect(c.matchPercent).toBeGreaterThanOrEqual(80);
    const sum = Object.values(c.scoreBreakdown.contributionsPercent).reduce((a, b) => a + b, 0);
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
      bankAccount: { name: 'Other Account' },
    };

    (prisma.transaction.findUniqueOrThrow as any).mockResolvedValue(mockCredit);
    (prisma.transaction.findMany as any).mockResolvedValue([mockDebit]);

    const candidates = await getCleansingDebitCandidates({
      userId: 'user-1',
      creditId: 'credit-1',
      bankAccountId: 'acc-1',
    });

    expect(candidates[0]!.matchPercent).toBeLessThan(50);
  });
});
