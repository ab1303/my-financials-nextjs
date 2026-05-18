import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '@/server/trpc/router/_app';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';

const caller = appRouter.createCaller({
  prisma: prismaMock,
  session: { user: { id: 'user-1' } },
} as never);

describe('categoryTransactionsRouter.getByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by category, month, and year', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        date: new Date('2025-02-10T10:00:00.000Z'),
        description: 'Woolworths',
        amount: 25.5 as never,
        category: 'Groceries',
        source: 'LLM_CLASSIFIED',
        status: 'CONFIRMED',
        bankAccount: { name: 'Everyday' },
      },
    ] as never);
    prismaMock.transaction.count.mockResolvedValue(1 as never);

    const result = await caller.categoryTransactions.getByCategory({
      category: 'groceries',
      month: 2,
      year: 2025,
      limit: 50,
      offset: 0,
    });

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          type: 'DEBIT',
          status: 'CONFIRMED',
          category: expect.objectContaining({ equals: 'groceries', mode: 'insensitive' }),
        }),
        skip: 0,
        take: 50,
      }),
    );

    expect(result.transactions).toEqual([
      {
        id: 'tx-1',
        date: '2025-02-10',
        description: 'Woolworths',
        amount: 25.5,
        category: 'Groceries',
        source: 'LLM_CLASSIFIED',
        status: 'CONFIRMED',
        bankAccountName: 'Everyday',
      },
    ]);
    expect(result.total).toBe(1);
  });

  it('calculates totals correctly', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        date: new Date('2025-02-10T10:00:00.000Z'),
        description: 'Woolworths',
        amount: 25.5 as never,
        category: 'Groceries',
        source: 'LLM_CLASSIFIED',
        status: 'CONFIRMED',
        bankAccount: { name: 'Everyday' },
      },
      {
        id: 'tx-2',
        date: new Date('2025-02-12T10:00:00.000Z'),
        description: 'Coles',
        amount: 14.5 as never,
        category: 'Groceries',
        source: 'USER_OVERRIDE',
        status: 'CONFIRMED',
        bankAccount: { name: 'Everyday' },
      },
    ] as never);
    prismaMock.transaction.count.mockResolvedValue(2 as never);

    const result = await caller.categoryTransactions.getByCategory({
      category: 'groceries',
      month: 2,
      year: 2025,
      limit: 50,
      offset: 0,
    });

    expect(result.totalAmount).toBe(40);
    expect(result.averageAmount).toBe(20);
  });
});
