import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
vi.mock('@/server/db/client', () => ({
  prisma: prismaMock,
}));

import { confirmCreditTransactions, confirmDebitTransactions } from '@/server/services/transactions/csv-confirm.service';
import { appRouter } from '@/server/trpc/router/_app';

const mockCredits = [
  {
    month: '2024-01',
    transactions: [
      {
        id: 'cr-1',
        description: 'EMPLOYER SALARY',
        amount: 5000,
        date: '2024-01-01',
        llmCategory: 'Employment',
        confirmedCategory: 'Employment',
        overridden: false,
        type: 'CREDIT' as const,
      },
    ],
  },
];

describe('csv-confirm.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.calendarYear.findFirst.mockResolvedValue({ id: 'calendar-1', type: 'FISCAL', fromYear: 2024, fromMonth: 1, toYear: 2024, toMonth: 12 } as never);
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.create.mockResolvedValue({ id: 'transaction-1' } as never);
  });

  it('creates a CONFIRMED CREDIT Transaction for confirmed income (no IncomeRecord created)', async () => {
    await confirmCreditTransactions(mockCredits as never, 'user-1', 'bank-1', 'session-1');

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT',
          status: 'CONFIRMED',
          category: 'Employment',
          userId: 'user-1',
          bankAccountId: 'bank-1',
          importSessionId: 'session-1',
        }),
      }),
    );
  });

  it('creates an EXCLUDED CREDIT Transaction for excluded categories', async () => {
    const excludedCredits = [
      {
        month: '2024-01',
        transactions: [
          {
            id: 'cr-2',
            description: 'INTERNAL TRANSFER',
            amount: 1000,
            date: '2024-01-02',
            llmCategory: 'Transfer',
            confirmedCategory: 'Transfer',
            overridden: false,
            type: 'CREDIT' as const,
          },
        ],
      },
    ];

    await confirmCreditTransactions(excludedCredits as never, 'user-1', 'bank-1', 'session-1');

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT',
          status: 'EXCLUDED',
          category: 'Transfer',
        }),
      }),
    );
  });

  describe('confirmDebitTransactions — Transfer exclusion guard', () => {
    beforeEach(() => {
      prismaMock.expenseLedger.findUnique.mockResolvedValue({ id: 'ledger-1' } as never);
      prismaMock.expenseLedger.create.mockResolvedValue({ id: 'ledger-1' } as never);
      prismaMock.expenseCategory.findMany.mockResolvedValue([
        { id: 'cat-groceries', name: 'Groceries', isActive: true },
        { id: 'cat-other', name: 'Other', isActive: true },
      ] as never);
      prismaMock.monthlyExpenseSummary.findFirst.mockResolvedValue(null);
      prismaMock.merchantCategoryMap.upsert.mockResolvedValue({} as never);
    });

    it('saves Transfer DEBIT as EXCLUDED and skips MonthlyExpenseSummary', async () => {
      await confirmDebitTransactions(
        [
          {
            month: '2024-01',
            transactions: [
              {
                id: 'tx-transfer',
                description: 'Transfer to Savings',
                amount: 3000,
                date: '2024-01-15',
                llmCategory: 'Transfer',
                confirmedCategory: 'Transfer',
                overridden: false,
                balance: null,
              },
            ],
          },
        ] as never,
        'user-1',
        'bank-1',
        'session-1',
      );

      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'Transfer',
            status: 'EXCLUDED',
          }),
        }),
      );

      // Must NOT create a MonthlyExpenseSummary entry for Transfer transactions
      expect(prismaMock.monthlyExpenseSummary.create).not.toHaveBeenCalled();
      expect(prismaMock.monthlyExpenseSummary.update).not.toHaveBeenCalled();
    });

    it('saves non-Transfer DEBIT as CONFIRMED and creates MonthlyExpenseSummary', async () => {
      await confirmDebitTransactions(
        [
          {
            month: '2024-01',
            transactions: [
              {
                id: 'tx-grocery',
                description: 'Woolworths',
                amount: 85,
                date: '2024-01-10',
                llmCategory: 'Groceries',
                confirmedCategory: 'Groceries',
                overridden: false,
                balance: null,
              },
            ],
          },
        ] as never,
        'user-1',
        'bank-1',
        'session-1',
      );

      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'Groceries',
            status: 'CONFIRMED',
          }),
        }),
      );

      expect(prismaMock.monthlyExpenseSummary.create).toHaveBeenCalled();
    });
  });
});

describe('transactionLedger.getFilterOptions', () => {
  const caller = appRouter.createCaller({
    prisma: prismaMock,
    session: { user: { id: 'user-1' } },
  } as any);

  beforeEach(() => {
    prismaMock.expenseCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Groceries' },
    ] as never);
    prismaMock.incomeSource.findMany.mockResolvedValue([
      { id: 'source-1', name: 'Employment' },
      { id: 'source-2', name: 'Other' },
    ] as never);
  });

  it('returns income sources from DB', async () => {
    await expect(caller.transactionLedger.getFilterOptions()).resolves.toEqual({
      expenseCategories: [{ id: 'cat-1', name: 'Groceries' }],
      incomeSourceLabels: [
        { id: 'source-1', name: 'Employment' },
        { id: 'source-2', name: 'Other' },
      ],
    });
  });
});
