import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from '@/server/trpc/router/_app';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { buildTransactionWhere } from '@/server/trpc/router/transaction-ledger';


describe('buildTransactionWhere', () => {
  it('filters uncategorized transactions by empty category', () => {
    const where = buildTransactionWhere({ uncategorized: true } as never, 'user-1');

    expect(where.userId).toBe('user-1');
    expect(where.category).toBe('');
  });

  it('applies amount range filters', () => {
    const where = buildTransactionWhere({ amountMin: 500, amountMax: 1000 } as never, 'user-1');

    expect(where.amount).toEqual({ gte: 500, lte: 1000 });
  });

  it('applies date range filters', () => {
    const where = buildTransactionWhere({ dateFrom: '2024-01-01', dateTo: '2024-01-31' } as never, 'user-1');

    expect(where.date).toBeDefined();
    expect(where.date).toMatchObject({
      gte: new Date('2024-01-01T00:00:00'),
      lte: new Date('2024-01-31T23:59:59.999'),
    });
  });

  it('filters by category', () => {
    const where = buildTransactionWhere({ category: 'Groceries' } as never, 'user-1');

    expect(where.category).toBe('Groceries');
  });
});


describe('transactionLedgerRouter.getFilterOptions', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user-1' } },
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns income source labels from the database', async () => {
    prismaMock.expenseCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Groceries' },
    ] as never);
    prismaMock.incomeSource.findMany.mockResolvedValue([
      { id: 'src-1', name: 'Employment' },
      { id: 'src-2', name: 'Other' },
    ] as never);

    await expect(caller.transactionLedger.getFilterOptions()).resolves.toEqual({
      expenseCategories: [{ id: 'cat-1', name: 'Groceries' }],
      incomeSourceLabels: ['Employment', 'Other'],
    });
  });
});
