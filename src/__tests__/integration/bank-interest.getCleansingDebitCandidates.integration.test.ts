import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { appRouter } from '@/server/trpc/router/_app';

const caller = appRouter.createCaller({
  prisma: prismaMock,
  session: { user: { id: 'user-1' } },
} as never);

describe('bankInterest.getCleansingDebitCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ranked candidates with augmented DTO', async () => {
    // 1. Mock the credit transaction (the interest being cleansed)
    prismaMock.transaction.findUniqueOrThrow.mockResolvedValue({
      id: 'credit-1',
      amount: new Decimal(100.0),
      date: new Date('2026-06-01'),
      description: 'Interest Payment',
      bankAccountId: 'acc-1',
    } as never);

    // 2. Mock the candidate debits
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'debit-1',
        amount: new Decimal(100.0),
        date: new Date('2026-06-02'),
        description: 'Interest Cleansing Transfer',
        bankAccountId: 'acc-1',
        financialAccount: { name: 'Main Account' },
        interestCleansingEvidence: [],
      },
      {
        id: 'debit-2',
        amount: new Decimal(50.0),
        date: new Date('2026-05-15'),
        description: 'Other Transfer',
        bankAccountId: 'acc-2',
        financialAccount: { name: 'Savings' },
        interestCleansingEvidence: [],
      },
    ] as never);

    const result = await caller.bankInterest.getCleansingDebitCandidates({
      creditId: 'credit-1',
      bankAccountId: 'acc-1',
    });

    expect(result.length).toBe(2);

    // First candidate should be high match
    const best = result[0]!;
    expect(best.transactionId).toBe('debit-1');
    expect(best.matchPercent).toBeGreaterThan(80);
    expect(best.accountName).toBe('Main Account');
    expect(best.scoreBreakdown.contributionsPercent.amount).toBeGreaterThan(0);

    // Sum of contributions should equal matchPercent
    const sum = Object.values(best.scoreBreakdown.contributionsPercent).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(best.matchPercent);

    // Verify Prisma call
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          type: 'DEBIT',
          status: 'CONFIRMED',
          category: expect.objectContaining({
            equals: 'Interest Cleansing',
            mode: 'insensitive',
          }),
        }),
      }),
    );
  });

  it('supports numeric amount search', async () => {
    prismaMock.transaction.findUniqueOrThrow.mockResolvedValue({
      id: 'credit-1',
      amount: new Decimal(100.0),
      date: new Date('2026-06-01'),
      description: 'Interest',
    } as never);

    prismaMock.transaction.findMany.mockResolvedValue([]);

    await caller.bankInterest.getCleansingDebitCandidates({
      creditId: 'credit-1',
      search: '50',
    });

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { description: { contains: '50', mode: 'insensitive' } },
                { amount: { equals: 50 } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });
});
