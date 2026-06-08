import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { appRouter } from '@/server/trpc/router/_app';
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
          incomeSourceLabels: [{ id: 'src-1', name: 'Employment' }, { id: 'src-2', name: 'Other' }],
    });
  });
});


describe('transactionLedgerRouter.getAll — cursor pagination', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user-1' } },
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    // mock aggregate queries
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
  });

  it('returns nextCursor when more rows exist than the limit', async () => {
    // Mock limit+1 rows (51 rows when limit=50)
    const mockRows = Array.from({ length: 51 }, (_, i) => ({
      id: `tx-${i + 1}`,
      date: new Date('2024-01-01'),
      description: `Transaction ${i + 1}`,
      amount: { toNumber: () => 100 } as any,
      type: 'DEBIT',
      category: 'Groceries',
      source: 'LLM_CLASSIFIED',
      status: 'CONFIRMED',
      confirmedAt: null,
      bankAccountId: null,
      offsetCategory: null,
      offsetTransactionId: null,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      financialAccount: null,
      reimbursements: [],
      donationPayment: null,
      transferLinkedTransaction: null,
      transferCounterpart: null,
      transferLinkedTransactionId: null,
      importSession: null,
    }));
    prismaMock.transaction.findMany.mockResolvedValue(mockRows as never);

    const result = await caller.transactionLedger.getAll({ limit: 50 });

    expect(result.transactions).toHaveLength(50);
    expect(result.nextCursor).toBe('tx-50'); // last of the 50 returned rows
  });

  it('returns nextCursor null on the last page', async () => {
    // Mock exactly limit rows (no more pages)
    const mockRows = Array.from({ length: 10 }, (_, i) => ({
      id: `tx-${i + 1}`,
      date: new Date('2024-01-01'),
      description: `Transaction ${i + 1}`,
      amount: { toNumber: () => 50 } as any,
      type: 'CREDIT',
      category: 'Salary',
      source: 'LLM_CLASSIFIED',
      status: 'CONFIRMED',
      confirmedAt: null,
      bankAccountId: null,
      offsetCategory: null,
      offsetTransactionId: null,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      financialAccount: null,
      reimbursements: [],
      donationPayment: null,
      transferLinkedTransaction: null,
      transferCounterpart: null,
      transferLinkedTransactionId: null,
      importSession: null,
    }));
    prismaMock.transaction.findMany.mockResolvedValue(mockRows as never);

    const result = await caller.transactionLedger.getAll({ limit: 50 });

    expect(result.transactions).toHaveLength(10);
    expect(result.nextCursor).toBeNull();
  });

  it('passes cursor to findMany when cursor is provided', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([] as never);

    await caller.transactionLedger.getAll({ cursor: 'clabcdef0000' });

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'clabcdef0000' },
        skip: 1,
      }),
    );
  });

  it('does not call transaction.count', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([] as never);

    await caller.transactionLedger.getAll({});

    expect(prismaMock.transaction.count).not.toHaveBeenCalled();
  });
});
