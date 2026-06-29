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

describe('bankInterest.getCleansingDebitCandidates integration-ish', () => {
  it('should return Candidate DTO with all required fields', async () => {
    const mockCredit = {
      id: 'c1',
      amount: { toNumber: () => 50.5 },
      date: new Date(),
      description: 'Interest',
    };

    const mockDebit = {
      id: 'd1',
      amount: 50.5,
      date: new Date(),
      description: 'Cleansing Donation',
      bankAccountId: 'ba1',
      bankAccount: { name: 'Test Bank' },
      interestCleansingEvidence: [],
    };

    (prisma.transaction.findUniqueOrThrow as any).mockResolvedValue(mockCredit);
    (prisma.transaction.findMany as any).mockResolvedValue([mockDebit]);

    const result = await getCleansingDebitCandidates({
      userId: 'u1',
      creditId: 'c1',
    });

    expect(result).toHaveLength(1);
    const candidate = result[0]!;

    expect(candidate).toHaveProperty('transactionId');
    expect(candidate).toHaveProperty('matchPercent');
    expect(candidate).toHaveProperty('accountName');
    expect(candidate).toHaveProperty('scoreBreakdown');
    expect(candidate.scoreBreakdown).toHaveProperty('contributionsPercent');
    expect(candidate.scoreBreakdown.contributionsPercent).toHaveProperty(
      'amount',
    );
    expect(candidate.scoreBreakdown.contributionsPercent).toHaveProperty(
      'date',
    );
    expect(candidate.scoreBreakdown.contributionsPercent).toHaveProperty(
      'desc',
    );
    expect(candidate.scoreBreakdown.contributionsPercent).toHaveProperty(
      'account',
    );
  });
});
