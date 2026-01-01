import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  addIncomeEntry,
  deleteIncomeEntry,
  getIncomeEntries,
  getTotalIncome,
  updateIncomeEntry,
} from '@/server/services/income.service';
import { prismaMock } from '../mocks/prisma.mock';
import { createMockIncomeEntry } from '../mocks/income.mock';

describe('Income Service - CRUD Operations', () => {
  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';
  const incomeId = 'test-income-id';

  beforeEach(() => {
    // Reset mocks before each test
  });

  describe('getIncomeEntries', () => {
    it('should return income entries for a calendar year', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          incomeId,
          dateEarned: new Date('2024-01-15'),
          amount: new Decimal('5000.00'),
          source: 'EMPLOYMENT' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          income: {
            id: incomeId,
            calendarId: calendarYearId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'entry-2',
          incomeId,
          dateEarned: new Date('2024-02-15'),
          amount: new Decimal('5000.00'),
          source: 'EMPLOYMENT' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          income: {
            id: incomeId,
            calendarId: calendarYearId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      prismaMock.incomeEntry.findMany.mockResolvedValue(mockEntries);

      const result = await getIncomeEntries(calendarYearId, userId);

      expect(result).toHaveLength(2);
      expect(result[0]?.amount).toBe(5000);
      expect(result[0]?.source).toBe('EMPLOYMENT');
      expect(prismaMock.incomeEntry.findMany).toHaveBeenCalledWith({
        where: {
          income: {
            calendarId: calendarYearId,
            userId,
          },
        },
        include: {
          income: true,
        },
        orderBy: {
          dateEarned: 'desc',
        },
      });
    });

    it('should return empty array when no entries exist', async () => {
      prismaMock.incomeEntry.findMany.mockResolvedValue([]);

      const result = await getIncomeEntries(calendarYearId, userId);

      expect(result).toEqual([]);
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
        incomeId,
        dateEarned: entryData.dateEarned,
        amount: new Decimal('5000.00'),
        source: entryData.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.incomeEntry.create.mockResolvedValue(mockCreatedEntry);

      const result = await addIncomeEntry(incomeId, entryData);

      expect(result.id).toBe('new-entry-id');
      expect(result.amount.toNumber()).toBe(5000);
      expect(prismaMock.incomeEntry.create).toHaveBeenCalledWith({
        data: {
          incomeId,
          dateEarned: entryData.dateEarned,
          amount: entryData.amount,
          source: entryData.source,
        },
      });
    });

    it('should handle different income sources', async () => {
      const sources: Array<
        'EMPLOYMENT' | 'BUSINESS' | 'INVESTMENT' | 'RENTAL' | 'GIFT' | 'ZAKAT' | 'OTHER'
      > = ['BUSINESS', 'INVESTMENT', 'RENTAL', 'GIFT', 'ZAKAT', 'OTHER'];

      for (const source of sources) {
        const entryData = {
          dateEarned: new Date('2024-01-15'),
          amount: 1000,
          source,
        };

        const mockEntry = createMockIncomeEntry({
          source,
          amount: new Decimal('1000.00'),
        });

        prismaMock.incomeEntry.create.mockResolvedValue(mockEntry);

        const result = await addIncomeEntry(incomeId, entryData);

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
        incomeId,
        dateEarned: updatedData.dateEarned,
        amount: new Decimal('6000.00'),
        source: updatedData.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.incomeEntry.update.mockResolvedValue(mockUpdatedEntry);

      await updateIncomeEntry(entryId, updatedData);

      expect(prismaMock.incomeEntry.update).toHaveBeenCalledWith({
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

      prismaMock.incomeEntry.delete.mockResolvedValue(
        createMockIncomeEntry({ id: entryId })
      );

      await deleteIncomeEntry(entryId);

      expect(prismaMock.incomeEntry.delete).toHaveBeenCalledWith({
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

      prismaMock.incomeEntry.aggregate.mockResolvedValue(mockAggregate);

      const total = await getTotalIncome(calendarYearId, userId);

      expect(total).toBe(15000);
      expect(prismaMock.incomeEntry.aggregate).toHaveBeenCalledWith({
        where: {
          income: {
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

      prismaMock.incomeEntry.aggregate.mockResolvedValue(mockAggregate);

      const total = await getTotalIncome(calendarYearId, userId);

      expect(total).toBe(0);
    });
  });
});
