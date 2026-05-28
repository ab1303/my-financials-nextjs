import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import {
  rerollupExpenseSummary,
  updateIncomeRecordSource,
} from '@/server/services/transactions/ledger.service';

describe('ledger.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rerollupExpenseSummary', () => {
    it('returns early when no FISCAL calendar is found', async () => {
      prismaMock.calendarYear.findFirst.mockResolvedValue(null);

      await rerollupExpenseSummary({
        prismaClient: prismaMock,
        userId: 'user-1',
        oldCategory: 'Groceries',
        newCategory: 'Dining Out',
        amount: new Decimal('25.00'),
        date: new Date('2024-01-15'),
      });

      expect(prismaMock.expenseLedger.findUnique).not.toHaveBeenCalled();
    });

    it('returns early when no expenseLedger is found', async () => {
      prismaMock.calendarYear.findFirst.mockResolvedValue({
        id: 'calendar-1',
        type: 'FISCAL',
      } as never);
      prismaMock.expenseLedger.findUnique.mockResolvedValue(null);

      await rerollupExpenseSummary({
        prismaClient: prismaMock,
        userId: 'user-1',
        oldCategory: 'Groceries',
        newCategory: 'Dining Out',
        amount: new Decimal('25.00'),
        date: new Date('2024-01-15'),
      });

      expect(prismaMock.expenseCategory.findFirst).not.toHaveBeenCalled();
    });

    it('decrements the old category and increments the new category when summary exists', async () => {
      prismaMock.calendarYear.findFirst.mockResolvedValue({
        id: 'calendar-1',
        type: 'FISCAL',
      } as never);
      prismaMock.expenseLedger.findUnique.mockResolvedValue({
        id: 'ledger-1',
        calendarId: 'calendar-1',
        userId: 'user-1',
      } as never);
      prismaMock.expenseCategory.findFirst
        .mockResolvedValueOnce({ id: 'cat-old', name: 'Groceries' } as never)
        .mockResolvedValueOnce({ id: 'cat-new', name: 'Dining Out' } as never);
      prismaMock.monthlyExpenseSummary.findFirst.mockResolvedValue({
        id: 'summary-new',
      } as never);
      prismaMock.monthlyExpenseSummary.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.monthlyExpenseSummary.update.mockResolvedValue({ id: 'summary-new' } as never);

      await rerollupExpenseSummary({
        prismaClient: prismaMock,
        userId: 'user-1',
        oldCategory: 'Groceries',
        newCategory: 'Dining Out',
        amount: new Decimal('25.00'),
        date: new Date('2024-01-15'),
      });

      expect(prismaMock.monthlyExpenseSummary.updateMany).toHaveBeenCalledWith({
        where: {
          expenseLedgerId: 'ledger-1',
          categoryId: 'cat-old',
          month: 1,
        },
        data: {
          amount: {
            decrement: new Decimal('25.00'),
          },
        },
      });
      expect(prismaMock.monthlyExpenseSummary.update).toHaveBeenCalledWith({
        where: { id: 'summary-new' },
        data: {
          amount: {
            increment: new Decimal('25.00'),
          },
        },
      });
    });

    it('creates a new MonthlyExpenseSummary when none exists yet', async () => {
      prismaMock.calendarYear.findFirst.mockResolvedValue({
        id: 'calendar-1',
        type: 'FISCAL',
      } as never);
      prismaMock.expenseLedger.findUnique.mockResolvedValue({
        id: 'ledger-1',
        calendarId: 'calendar-1',
        userId: 'user-1',
      } as never);
      prismaMock.expenseCategory.findFirst
        .mockResolvedValueOnce({ id: 'cat-old', name: 'Groceries' } as never)
        .mockResolvedValueOnce({ id: 'cat-new', name: 'Dining Out' } as never);
      prismaMock.monthlyExpenseSummary.findFirst.mockResolvedValue(null);
      prismaMock.monthlyExpenseSummary.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.monthlyExpenseSummary.create.mockResolvedValue({
        id: 'summary-new',
      } as never);

      await rerollupExpenseSummary({
        prismaClient: prismaMock,
        userId: 'user-1',
        oldCategory: 'Groceries',
        newCategory: 'Dining Out',
        amount: new Decimal('25.00'),
        date: new Date('2024-01-15'),
      });

      expect(prismaMock.monthlyExpenseSummary.create).toHaveBeenCalledWith({
        data: {
          month: 1,
          amount: new Decimal('25.00'),
          categoryId: 'cat-new',
          expenseLedgerId: 'ledger-1',
        },
      });
    });
  });

  describe('updateIncomeRecordSource', () => {
    it('is a no-op — does not query any Prisma models', async () => {
      await updateIncomeRecordSource({
        prismaClient: prismaMock,
        userId: 'user-1',
        newSourceName: 'Employment',
        amount: new Decimal('1200.00'),
        transactionDate: new Date('2024-02-01'),
      });

      // Transaction is now the SoT; category update is applied to Transaction.category by the caller.
      // This function is a no-op and must not touch any DB tables.
      expect(prismaMock.transaction.update).not.toHaveBeenCalled();
      expect(prismaMock.incomeSource.update).not.toHaveBeenCalled();
    });
  });
});