import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: {
    calendarYear: {
      findFirst: vi.fn(),
    },
    expenseLedger: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    monthlyExpenseSummary: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    expenseCategory: {
      findMany: vi.fn(),
    },
    incomeLedger: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    incomeRecord: {
      create: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    merchantCategoryMap: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/db/client';
import type { CreditMonth, DebitMonth } from '@/server/services/transactions/_types';
import {
  confirmCreditTransactions,
  confirmDebitTransactions,
} from '@/server/services/transactions/csv-confirm.service';

const mockCalendarYear = {
  id: 'cal-1',
  fromYear: 2024,
  fromMonth: 7,
  toYear: 2025,
  toMonth: 6,
};
const mockLedger = { id: 'ledger-1' };
const mockIncomeLedger = { id: 'income-ledger-1' };

const mockDebitMonths: DebitMonth[] = [
  {
    month: '2024-01',
    transactions: [
      {
        id: 'tx-1',
        description: 'WOOLWORTHS',
        amount: 50,
        date: '2024-01-15',
        llmCategory: 'Groceries',
        confirmedCategory: 'Groceries',
        overridden: false,
        type: 'DEBIT' as const,
      },
    ],
  },
];

const mockCreditMonths: CreditMonth[] = [
  {
    month: '2024-01',
    transactions: [
      {
        id: 'cr-1',
        description: 'EMPLOYER SALARY',
        amount: 5000,
        date: '2024-01-01',
        llmCategory: 'EMPLOYMENT',
        confirmedCategory: 'EMPLOYMENT',
        overridden: false,
        type: 'CREDIT' as const,
      },
      {
        id: 'cr-2',
        description: 'BANK TRANSFER',
        amount: 200,
        date: '2024-01-10',
        llmCategory: 'Transfer',
        confirmedCategory: 'Transfer',
        overridden: false,
        type: 'CREDIT' as const,
      },
    ],
  },
];

describe('confirmDebitTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.calendarYear.findFirst as any).mockResolvedValue(mockCalendarYear);
    (prisma.expenseLedger.findUnique as any).mockResolvedValue(mockLedger);
    (prisma.monthlyExpenseSummary.findFirst as any).mockResolvedValue(null);
    (prisma.monthlyExpenseSummary.create as any).mockResolvedValue({ id: 'sum-1' });
    (prisma.transaction.create as any).mockResolvedValue({ id: 'tr-1' });
    (prisma.merchantCategoryMap.upsert as any).mockResolvedValue({});
    (prisma.expenseCategory.findMany as any).mockResolvedValue([
      { id: 'cat-1', name: 'Groceries' },
    ]);
    (prisma.transaction.findMany as any).mockResolvedValue([]);
  });

  it('processes debit months and returns save result', async () => {
    const result = await confirmDebitTransactions(
      mockDebitMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(result.savedMonths).toBe(1);
    expect(result.totalEntries).toBe(1);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(prisma.transaction.create).toHaveBeenCalledOnce();
    expect(prisma.monthlyExpenseSummary.create).toHaveBeenCalledOnce();
  });

  it('creates ExpenseLedger when not found', async () => {
    (prisma.expenseLedger.findUnique as any).mockResolvedValue(null);
    (prisma.expenseLedger.create as any).mockResolvedValue(mockLedger);

    const result = await confirmDebitTransactions(
      mockDebitMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(prisma.expenseLedger.create).toHaveBeenCalledOnce();
    expect(result.savedMonths).toBe(1);
    expect(result.duplicatesSkipped).toBe(0);
  });

  it('returns error when no fiscal year found for month', async () => {
    (prisma.calendarYear.findFirst as any).mockResolvedValue(null);

    const result = await confirmDebitTransactions(
      mockDebitMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.month).toBe('2024-01');
    expect(result.savedMonths).toBe(0);
    expect(result.duplicatesSkipped).toBe(0);
  });

  it('increments existing MonthlyExpenseSummary', async () => {
    (prisma.monthlyExpenseSummary.findFirst as any).mockResolvedValue({ id: 'existing-sum' });
    (prisma.monthlyExpenseSummary.update as any).mockResolvedValue({});

    const result = await confirmDebitTransactions(
      mockDebitMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(prisma.monthlyExpenseSummary.update).toHaveBeenCalledOnce();
    expect(prisma.monthlyExpenseSummary.create).not.toHaveBeenCalled();
    expect(result.duplicatesSkipped).toBe(0);
  });

  it('skips duplicate debit transactions', async () => {
    (prisma.transaction.findMany as any).mockResolvedValue([
      {
        date: new Date('2024-01-15'),
        description: 'WOOLWORTHS',
        amount: 50,
        type: 'DEBIT',
      },
    ]);

    const result = await confirmDebitTransactions(
      mockDebitMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(result.duplicatesSkipped).toBe(1);
    expect(result.totalEntries).toBe(0);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.monthlyExpenseSummary.create).not.toHaveBeenCalled();
  });

  it('catches intra-batch duplicate debit rows', async () => {
    (prisma.transaction.findMany as any).mockResolvedValue([]);
    const duplicatedMonths: DebitMonth[] = [
      {
        month: '2024-01',
        transactions: [
          {
            id: 'tx-1',
            description: 'WOOLWORTHS',
            amount: 50,
            date: '2024-01-15',
            llmCategory: 'Groceries',
            confirmedCategory: 'Groceries',
            overridden: false,
            type: 'DEBIT' as const,
          },
          {
            id: 'tx-2',
            description: 'WOOLWORTHS',
            amount: 50,
            date: '2024-01-15',
            llmCategory: 'Groceries',
            confirmedCategory: 'Groceries',
            overridden: false,
            type: 'DEBIT' as const,
          },
        ],
      },
    ];

    const result = await confirmDebitTransactions(
      duplicatedMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(result.totalEntries).toBe(1);
    expect(result.duplicatesSkipped).toBe(1);
  });
});

describe('confirmCreditTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.calendarYear.findFirst as any).mockResolvedValue(mockCalendarYear);
    (prisma.incomeLedger.findUnique as any).mockResolvedValue(mockIncomeLedger);
    (prisma.incomeRecord.create as any).mockResolvedValue({ id: 'inc-1' });
    (prisma.transaction.create as any).mockResolvedValue({ id: 'tr-2' });
    (prisma.transaction.findMany as any).mockResolvedValue([]);
  });

  it('saves income records for non-excluded credits', async () => {
    const result = await confirmCreditTransactions(
      mockCreditMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(result.totalEntries).toBe(2);
    expect(result.duplicatesSkipped).toBe(0);
    expect(prisma.incomeRecord.create).toHaveBeenCalledOnce();
    expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
  });

  it('creates EXCLUDED transaction record for Transfer/Excluded credits', async () => {
    const result = await confirmCreditTransactions(mockCreditMonths, 'user-1', 'bank-1', 'session-1');
    const calls = (prisma.transaction.create as any).mock.calls;
    const excludedCall = calls.find((c: any) => c[0].data.status === 'EXCLUDED');
    expect(excludedCall).toBeDefined();
    expect(excludedCall[0].data.type).toBe('CREDIT');
    expect(result.duplicatesSkipped).toBe(0);
  });

  it('creates IncomeLedger when not found', async () => {
    (prisma.incomeLedger.findUnique as any).mockResolvedValue(null);
    (prisma.incomeLedger.create as any).mockResolvedValue(mockIncomeLedger);

    const result = await confirmCreditTransactions(mockCreditMonths, 'user-1', 'bank-1', 'session-1');
    expect(prisma.incomeLedger.create).toHaveBeenCalledOnce();
    expect(result.duplicatesSkipped).toBe(0);
  });

  it('skips duplicate credit transactions', async () => {
    (prisma.transaction.findMany as any).mockResolvedValue([
      {
        date: new Date('2024-01-01'),
        description: 'EMPLOYER SALARY',
        amount: 5000,
        type: 'CREDIT',
      },
      {
        date: new Date('2024-01-10'),
        description: 'BANK TRANSFER',
        amount: 200,
        type: 'CREDIT',
      },
    ]);

    const result = await confirmCreditTransactions(
      mockCreditMonths,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(result.duplicatesSkipped).toBe(2);
    expect(result.totalEntries).toBe(0);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.incomeRecord.create).not.toHaveBeenCalled();
  });

  it('handles description with different casing as duplicate', async () => {
    (prisma.transaction.findMany as any).mockResolvedValue([
      {
        date: new Date('2024-01-01'),
        description: 'employer salary',
        amount: 5000,
        type: 'CREDIT',
      },
    ]);

    const creditMonthsUpperCase: CreditMonth[] = [
      {
        month: '2024-01',
        transactions: [
          {
            id: 'cr-1',
            description: 'EMPLOYER SALARY',
            amount: 5000,
            date: '2024-01-01',
            llmCategory: 'EMPLOYMENT',
            confirmedCategory: 'EMPLOYMENT',
            overridden: false,
            type: 'CREDIT' as const,
          },
        ],
      },
    ];

    const result = await confirmCreditTransactions(
      creditMonthsUpperCase,
      'user-1',
      'bank-1',
      'session-1',
    );
    expect(result.duplicatesSkipped).toBe(1);
    expect(result.totalEntries).toBe(0);
  });
});
