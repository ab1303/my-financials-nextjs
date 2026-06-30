import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createIncomeYearHandler,
  incomeEntriesHandler,
  incomeHandler,
  totalIncomeHandler,
} from '@/server/controllers/income.controller';

import { createMockIncomeTransaction } from '../mocks/income.mock';
import { prismaMock } from '../mocks/prisma.mock';

describe('Income Controller', () => {
  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Stub handlers (IncomeLedger table dropped) ────────────────────────────
  describe('createIncomeYearHandler (stub)', () => {
    it('returns empty incomeCalendarId without querying DB', async () => {
      const result = await createIncomeYearHandler(calendarYearId, userId);
      expect(result.incomeCalendarId).toBe('');
      expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    });
  });

  describe('incomeHandler (stub)', () => {
    it('returns synthetic IncomeModel without querying DB', async () => {
      const result = await incomeHandler(calendarYearId, userId);
      expect(result?.id).toBe('');
      expect(result?.calendarId).toBe(calendarYearId);
      expect(result?.userId).toBe(userId);
    });
  });

  // ── Real handlers (Transaction SoT) ──────────────────────────────────────
  describe('incomeEntriesHandler', () => {
    it('returns mapped entries from CREDIT CONFIRMED transactions', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue({
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
      } as never);

      prismaMock.transaction.findMany.mockResolvedValue([
        createMockIncomeTransaction({
          id: 'txn-1',
          category: 'Employment',
          amount: new Decimal('5000'),
        }),
      ] as never);

      prismaMock.incomeSource.findMany.mockResolvedValue([
        {
          id: 'src-1',
          name: 'Employment',
          description: null,
          isActive: true,
          createdAt: new Date(),
        },
      ] as never);

      const result = await incomeEntriesHandler(calendarYearId, userId);

      expect(result).toHaveLength(1);
      expect(result?.[0]?.amount).toBe(5000);
      expect(result?.[0]?.incomeSourceName).toBe('Employment');
    });

    it('returns empty array when calendar year not found', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue(null);
      const result = await incomeEntriesHandler(calendarYearId, userId);
      expect(result).toEqual([]);
    });

    it('handles errors gracefully', async () => {
      prismaMock.calendarYear.findUnique.mockRejectedValue(
        new Error('Database error'),
      );
      const result = await incomeEntriesHandler(calendarYearId, userId);
      expect(result).toBeUndefined();
    });
  });

  describe('totalIncomeHandler', () => {
    it('returns total from aggregated CREDIT transactions', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue({
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
      } as never);

      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('15000.00') },
      } as never);

      const result = await totalIncomeHandler(calendarYearId, userId);
      expect(result).toBe(15000);
    });

    it('returns 0 when calendar year not found', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue(null);
      const result = await totalIncomeHandler(calendarYearId, userId);
      expect(result).toBe(0);
    });

    it('returns 0 when sum is null', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue({
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
      } as never);

      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      } as never);

      const result = await totalIncomeHandler(calendarYearId, userId);
      expect(result).toBe(0);
    });

    it('handles errors gracefully', async () => {
      prismaMock.calendarYear.findUnique.mockRejectedValue(
        new Error('Database error'),
      );
      const result = await totalIncomeHandler(calendarYearId, userId);
      expect(result).toBe(0);
    });
  });
});
