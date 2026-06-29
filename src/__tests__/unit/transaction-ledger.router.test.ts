import { TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { appRouter } from '@/server/trpc/router/_app';
import { buildTransactionWhere } from '@/server/trpc/router/transaction-ledger/shared';

describe('buildTransactionWhere', () => {
  it('filters uncategorized transactions by empty category', () => {
    const where = buildTransactionWhere(
      { uncategorized: true } as never,
      'user-1',
    );

    expect(where.userId).toBe('user-1');
    expect(where.category).toBe('');
  });

  it('applies amount range filters', () => {
    const where = buildTransactionWhere(
      { amountMin: 500, amountMax: 1000 } as never,
      'user-1',
    );

    expect(where.amount).toEqual({ gte: 500, lte: 1000 });
  });

  it('applies date range filters', () => {
    const where = buildTransactionWhere(
      { dateFrom: '2024-01-01', dateTo: '2024-01-31' } as never,
      'user-1',
    );

    expect(where.date).toBeDefined();
    expect(where.date).toMatchObject({
      gte: new Date('2024-01-01T00:00:00'),
      lte: new Date('2024-01-31T23:59:59.999'),
    });
  });

  it('filters by category', () => {
    const where = buildTransactionWhere(
      { category: 'Groceries' } as never,
      'user-1',
    );

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
      incomeSourceLabels: [
        { id: 'src-1', name: 'Employment' },
        { id: 'src-2', name: 'Other' },
      ],
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
    prismaMock.transaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as never);
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

describe('transactionLedgerRouter.updateCategory — EXCLUDED promotion', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user-1' } },
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes an EXCLUDED transaction to CONFIRMED when reclassified to a standard category', async () => {
    const txId = 'tx-1';
    const initialTx = {
      id: txId,
      userId: 'user-1',
      type: TransactionTypeEnum.DEBIT,
      status: TransactionStatusEnum.EXCLUDED,
      category: 'Excluded',
      description: 'Some excluded payment',
      amount: 100,
      date: new Date(),
    };
    prismaMock.transaction.findUnique.mockResolvedValue(initialTx as never);
    prismaMock.transaction.findMany.mockResolvedValue([] as never);
    prismaMock.transaction.update.mockResolvedValue({} as never);

    await caller.transactionLedger.updateCategory({
      id: txId,
      newCategory: 'Groceries',
    });

    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TransactionStatusEnum.CONFIRMED,
          category: 'Groceries',
        }),
      }),
    );
  });
});

describe('transactionLedgerRouter.previewMatchingCategoryChanges — preview query', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user-1' } },
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.transaction.count.mockResolvedValue(0 as never);
  });

  it('returns matching transactions, total count, and nextCursor for a given description', async () => {
    const transactionId = 'tx-1';
    const mockMatches = Array.from({ length: 6 }, (_, i) => ({
      id: `tx-match-${i + 1}`,
      date: new Date('2024-01-15'),
      description: 'Supermarket',
      amount: { toNumber: () => 50 + i * 10 } as any,
      type: TransactionTypeEnum.DEBIT,
      category: 'Groceries',
      source: 'LLM_CLASSIFIED',
      status: TransactionStatusEnum.CONFIRMED,
    }));

    prismaMock.transaction.findMany.mockResolvedValue(mockMatches as never);
    prismaMock.transaction.count.mockResolvedValue(6 as never);

    const result =
      await caller.transactionLedger.previewMatchingCategoryChanges({
        transactionId,
        description: 'Supermarket',
        limit: 5,
      });

    expect(result).toHaveProperty('matches');
    expect(result).toHaveProperty('totalCount');
    expect(result).toHaveProperty('nextCursor');
    expect(Array.isArray(result.matches)).toBe(true);
    expect(result.matches).toHaveLength(5);
    expect(result.totalCount).toBe(6);
    expect(result.nextCursor).toBe('tx-match-5');
  });

  it('filters matches by matchScope when provided (recent 90 days)', async () => {
    const transactionId = 'tx-1';
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-match-1',
        date: new Date('2024-01-15'),
        description: 'Supermarket',
        amount: { toNumber: () => 50 } as any,
        type: TransactionTypeEnum.DEBIT,
        category: 'Groceries',
        status: TransactionStatusEnum.CONFIRMED,
      },
    ] as never);
    prismaMock.transaction.count.mockResolvedValue(1 as never);

    await caller.transactionLedger.previewMatchingCategoryChanges({
      transactionId,
      description: 'Supermarket',
      matchScope: { type: 'recent', days: 90 },
    });

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('returns no rows and no cursor when the description does not produce a pattern', async () => {
    const transactionId = 'tx-1';
    prismaMock.transaction.findMany.mockResolvedValue([] as never);
    prismaMock.transaction.count.mockResolvedValue(0 as never);

    const result =
      await caller.transactionLedger.previewMatchingCategoryChanges({
        transactionId,
        description: 'to and of',
      });

    expect(result.matches).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.nextCursor).toBeNull();
  });
});
