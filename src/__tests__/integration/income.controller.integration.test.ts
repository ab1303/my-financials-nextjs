import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  createIncomeYearHandler,
  incomeHandler,
  incomeEntriesHandler,
  totalIncomeHandler,
} from '@/server/controllers/income.controller';
import { prismaMock } from '../mocks/prisma.mock';

describe('Income Controller', () => {
  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';
  const incomeId = 'test-income-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createIncomeYearHandler', () => {
    it('should return existing income record if it exists', async () => {
      const mockIncome = {
        id: incomeId,
        calendarId: calendarYearId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.income.findUnique.mockResolvedValue(mockIncome);

      const result = await createIncomeYearHandler(calendarYearId, userId);

      expect(result.incomeCalendarId).toBe(incomeId);
      expect(prismaMock.income.create).not.toHaveBeenCalled();
    });

    it('should create new income record if it does not exist', async () => {
      // First call returns null (not found)
      prismaMock.income.findUnique.mockResolvedValue(null);

      // Second call creates new record
      const mockNewIncome = {
        id: 'new-income-id',
        calendarId: calendarYearId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.income.create.mockResolvedValue(mockNewIncome);

      const result = await createIncomeYearHandler(calendarYearId, userId);

      expect(result.incomeCalendarId).toBe('new-income-id');
      expect(prismaMock.income.create).toHaveBeenCalledWith({
        data: {
          calendarId: calendarYearId,
          userId,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      prismaMock.income.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await createIncomeYearHandler(calendarYearId, userId);

      expect(result.incomeCalendarId).toBe('');
    });
  });

  describe('incomeHandler', () => {
    it('should return income record for calendar year', async () => {
      const mockIncome = {
        id: incomeId,
        calendarId: calendarYearId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.income.findUnique.mockResolvedValue(mockIncome);

      const result = await incomeHandler(calendarYearId, userId);

      expect(result?.id).toBe(incomeId);
      expect(result?.calendarId).toBe(calendarYearId);
    });

    it('should return empty object when income not found', async () => {
      prismaMock.income.findUnique.mockResolvedValue(null);

      const result = await incomeHandler(calendarYearId, userId);

      expect(result?.id).toBe('');
      expect(result?.calendarId).toBe(calendarYearId);
    });

    it('should handle errors gracefully', async () => {
      prismaMock.income.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await incomeHandler(calendarYearId, userId);

      expect(result).toBeUndefined();
    });
  });

  describe('incomeEntriesHandler', () => {
    it('should return array of income entries', async () => {
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
      ];

      prismaMock.incomeEntry.findMany.mockResolvedValue(mockEntries);

      const result = await incomeEntriesHandler(calendarYearId, userId);

      expect(result).toHaveLength(1);
      expect(result?.[0]?.amount).toBe(5000);
      expect(result?.[0]?.source).toBe('EMPLOYMENT');
    });

    it('should return empty array when no entries exist', async () => {
      prismaMock.incomeEntry.findMany.mockResolvedValue([]);

      const result = await incomeEntriesHandler(calendarYearId, userId);

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      prismaMock.incomeEntry.findMany.mockRejectedValue(new Error('Database error'));

      const result = await incomeEntriesHandler(calendarYearId, userId);

      expect(result).toBeUndefined();
    });
  });

  describe('totalIncomeHandler', () => {
    it('should return total income amount', async () => {
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

      const result = await totalIncomeHandler(calendarYearId, userId);

      expect(result).toBe(15000);
    });

    it('should return 0 when no entries exist', async () => {
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

      const result = await totalIncomeHandler(calendarYearId, userId);

      expect(result).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      prismaMock.incomeEntry.aggregate.mockRejectedValue(new Error('Database error'));

      const result = await totalIncomeHandler(calendarYearId, userId);

      expect(result).toBe(0);
    });
  });
});
