import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
vi.mock('@/server/db/client', () => ({
  prisma: prismaMock,
}));
import { confirmDebitTransactions } from '@/server/services/transactions/csv-confirm.service';

describe('csv-confirm.service - forceCreateIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.calendarYear.findFirst.mockResolvedValue({ id: 'calendar-1' } as never);
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-new' } as never);
    prismaMock.expenseLedger.findUnique.mockResolvedValue({ id: 'ledger-1' } as never);
    prismaMock.monthlyExpenseSummary.create.mockResolvedValue({} as never);
    prismaMock.expenseCategory.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food', isActive: true }] as never);
    prismaMock.expenseCategory.create.mockResolvedValue({ id: 'cat-other' } as never);
  });

  it('skips dedup check when csvId is in forceCreateIds', async () => {
    // Mock an existing transaction to cause a collision
    prismaMock.transaction.findMany.mockResolvedValue([{
        id: 'tx-existing',
        date: new Date('2025-01-15T00:00:00.000Z'),
        description: 'Woolworths',
        amount: 42.5,
        type: 'DEBIT',
        runningBalance: null,
    }] as never);

    await confirmDebitTransactions(
        [
          {
            month: '2025-01',
            transactions: [
              {
                id: 'csv-1',
                date: '2025-01-15',
                description: 'Woolworths',
                amount: 42.5,
                type: 'DEBIT',
                llmCategory: 'Food',
                confirmedCategory: 'Food',
                overridden: false,
                balance: null,
              },
            ],
          },
        ] as never,
        'user-1',
        'bank-1',
        'session-1',
        ['csv-1'] // forceCreateIds
      );

      // Verify transaction was created despite collision
      expect(prismaMock.transaction.create).toHaveBeenCalled();
  });
});
