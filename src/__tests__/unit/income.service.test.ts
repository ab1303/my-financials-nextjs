import { beforeEach, describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  getIncomeEntries,
  addIncomeEntry,
  updateIncomeEntry,
  deleteIncomeEntry,
  getTotalIncome,
} from '@/server/services/income.service';
import { createMockContext, type MockContext } from '../helpers/mock-context';

describe('Income Service - Unit Tests (Mocked)', () => {
  let mockCtx: MockContext;

  beforeEach(() => {
    mockCtx = createMockContext();
  });

  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';
  const incomeId = 'test-income-id';

  describe('getIncomeEntries', () => {
    it('should return income entries for a calendar year', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          incomeLedgerId: incomeId,
          dateEarned: new Date('2024-01-15'),
          amount: new Decimal('5000.00'),
          source: 'EMPLOYMENT' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          incomeLedger: {
            id: incomeId,
            calendarId: calendarYearId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'entry-2',
          incomeLedgerId: incomeId,
          dateEarned: new Date('2024-02-15'),
          amount: new Decimal('5000.00'),
          source: 'EMPLOYMENT' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          incomeLedger: {
            id: incomeId,
            calendarId: calendarYearId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      mockCtx.prisma.incomeRecord.findMany.mockResolvedValue(mockEntries);

      const result = await getIncomeEntries(
        calendarYearId,
        userId,
        mockCtx.prisma,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.amount).toBe(5000);
      expect(result[0]?.source).toBe('EMPLOYMENT');
      expect(mockCtx.prisma.incomeRecord.findMany).toHaveBeenCalledWith({
        where: {
          incomeLedger: {
            calendarId: calendarYearId,
            userId,
          },
        },
        include: {
          incomeLedger: true,
        },
        orderBy: {
          dateEarned: 'desc',
        },
      });
    });

    it('should return empty array when no entries exist', async () => {
      mockCtx.prisma.incomeRecord.findMany.mockResolvedValue([]);

      const result = await getIncomeEntries(
        calendarYearId,
        userId,
        mockCtx.prisma,
      );

      expect(result).toEqual([]);
      expect(mockCtx.prisma.incomeRecord.findMany).toHaveBeenCalled();
    });
  });

  describe('addIncomeEntry', () => {
    it('should create a new income entry', async () => {
      const entryData = {
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        source: 'EMPLOYMENT' as const,
      };

      const mockCreatedEntry = {
        id: 'new-entry-id',
        incomeLedgerId: incomeId,
        dateEarned: entryData.dateEarned,
        amount: new Decimal('5000.00'),
        source: entryData.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCtx.prisma.incomeRecord.create.mockResolvedValue(mockCreatedEntry);

      const result = await addIncomeEntry(incomeId, entryData, mockCtx.prisma);

      expect(result.id).toBe('new-entry-id');
      expect(result.amount.toNumber()).toBe(5000);
      expect(mockCtx.prisma.incomeRecord.create).toHaveBeenCalledWith({
        data: {
          incomeLedgerId: incomeId,
          dateEarned: entryData.dateEarned,
          amount: entryData.amount,
          source: entryData.source,
        },
      });
    });

    it('should handle all income source types', async () => {
      const sources: Array<
        | 'EMPLOYMENT'
        | 'BUSINESS'
        | 'INVESTMENT'
        | 'RENTAL'
        | 'GIFT'
        | 'ZAKAT'
        | 'OTHER'
      > = [
        'EMPLOYMENT',
        'BUSINESS',
        'INVESTMENT',
        'RENTAL',
        'GIFT',
        'ZAKAT',
        'OTHER',
      ];

      for (const source of sources) {
        const entryData = {
          dateEarned: new Date('2024-01-15'),
          amount: 1000,
          source,
        };

        const mockEntry = {
          id: `entry-${source}`,
          incomeLedgerId: incomeId,
          dateEarned: entryData.dateEarned,
          amount: new Decimal('1000.00'),
          source,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockCtx.prisma.incomeRecord.create.mockResolvedValue(mockEntry);

        const result = await addIncomeEntry(
          incomeId,
          entryData,
          mockCtx.prisma,
        );

        expect(result.source).toBe(source);
      }
    });
  });

  describe('updateIncomeEntry', () => {
    it('should update an existing income entry', async () => {
      const entryId = 'entry-to-update';
      const updatedData = {
        dateEarned: new Date('2024-02-15'),
        amount: 6000,
        source: 'BUSINESS' as const,
      };

      const mockUpdatedEntry = {
        id: entryId,
        incomeLedgerId: incomeId,
        dateEarned: updatedData.dateEarned,
        amount: new Decimal('6000.00'),
        source: updatedData.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCtx.prisma.incomeRecord.update.mockResolvedValue(mockUpdatedEntry);

      await updateIncomeEntry(entryId, updatedData, mockCtx.prisma);

      expect(mockCtx.prisma.incomeRecord.update).toHaveBeenCalledWith({
        where: { id: entryId },
        data: {
          dateEarned: updatedData.dateEarned,
          amount: updatedData.amount,
          source: updatedData.source,
        },
      });
    });
  });

  describe('deleteIncomeEntry', () => {
    it('should delete an income entry', async () => {
      const entryId = 'entry-to-delete';

      mockCtx.prisma.incomeRecord.delete.mockResolvedValue({
        id: entryId,
        incomeLedgerId: incomeId,
        dateEarned: new Date(),
        amount: new Decimal('1000.00'),
        source: 'EMPLOYMENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await deleteIncomeEntry(entryId, mockCtx.prisma);

      expect(mockCtx.prisma.incomeRecord.delete).toHaveBeenCalledWith({
        where: { id: entryId },
      });
    });
  });

  describe('getTotalIncome', () => {
    it('should calculate total income for a calendar year', async () => {
      const mockAggregate = {
        _sum: {
          amount: new Decimal('15000.00'),
        },
        _avg: { amount: null },
        _count: { amount: 0 },
        _max: { amount: null },
        _min: { amount: null },
      };

      mockCtx.prisma.incomeRecord.aggregate.mockResolvedValue(mockAggregate);

      const total = await getTotalIncome(
        calendarYearId,
        userId,
        mockCtx.prisma,
      );

      expect(total).toBe(15000);
      expect(mockCtx.prisma.incomeRecord.aggregate).toHaveBeenCalledWith({
        where: {
          incomeLedger: {
            calendarId: calendarYearId,
            userId,
          },
        },
        _sum: {
          amount: true,
        },
      });
    });

    it('should return 0 when no income entries exist', async () => {
      const mockAggregate = {
        _sum: {
          amount: null,
        },
        _avg: { amount: null },
        _count: { amount: 0 },
        _max: { amount: null },
        _min: { amount: null },
      };

      mockCtx.prisma.incomeRecord.aggregate.mockResolvedValue(mockAggregate);

      const total = await getTotalIncome(
        calendarYearId,
        userId,
        mockCtx.prisma,
      );

      expect(total).toBe(0);
    });

    it('should use correct filters for user scoping', async () => {
      const differentUserId = 'different-user';
      const mockAggregate = {
        _sum: { amount: new Decimal('5000.00') },
        _avg: { amount: null },
        _count: { amount: 0 },
        _max: { amount: null },
        _min: { amount: null },
      };

      mockCtx.prisma.incomeRecord.aggregate.mockResolvedValue(mockAggregate);

      await getTotalIncome(calendarYearId, differentUserId, mockCtx.prisma);

      expect(mockCtx.prisma.incomeRecord.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            incomeLedger: {
              calendarId: calendarYearId,
              userId: differentUserId,
            },
          },
        }),
      );
    });
  });
});
