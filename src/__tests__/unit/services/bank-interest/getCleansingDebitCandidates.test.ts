import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/server/db/client';
import { getCleansingDebitCandidates } from '@/server/services/interest-cleansing/interest-cleansing.service';

vi.mock('@/server/db/client', () => ({
  prisma: {
    transaction: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
    },
    interestCleansingEvidence: {
      findMany: vi.fn(),
    },
  },
}));

describe('getCleansingDebitCandidates', () => {
  const userId = 'user-1';
  const creditId = 'credit-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters and scores candidates correctly', async () => {
    const mockCredit = {
      id: creditId,
      amount: { toNumber: () => 100 },
      date: new Date('2026-06-01'),
      description: 'Interest Payment',
    };

    const mockCandidates = [
      {
        id: 'tx-1',
        amount: 100,
        date: new Date('2026-06-01'),
        description: 'Interest Payment',
        bankAccountId: 'acc-1',
        interestCleansingEvidence: [],
      },
      {
        id: 'tx-2',
        amount: 50,
        date: new Date('2026-06-05'),
        description: 'Random Payment',
        bankAccountId: 'acc-1',
        interestCleansingEvidence: [],
      },
    ];

    vi.mocked(prisma.transaction.findUniqueOrThrow).mockResolvedValue(
      mockCredit as any,
    );
    vi.mocked(prisma.transaction.findMany).mockResolvedValue(
      mockCandidates as any,
    );

    const candidates = await getCleansingDebitCandidates({
      userId,
      creditId,
      bankAccountId: 'acc-1',
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.transactionId).toBe('tx-1'); // Exact amount and description match
    expect(candidates[0]?.score).toBeGreaterThan(candidates[1]?.score ?? 0);
  });
});
