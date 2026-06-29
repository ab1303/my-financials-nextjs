import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addIncomeEntry,
  deleteIncomeEntry,
  getIncomeEntries,
  getTotalIncome,
  updateIncomeEntry,
} from '@/server/services/income.service';

import { createMockIncomeTransaction } from '../mocks/income.mock';
import { prismaMock } from '../mocks/prisma.mock';

describe('Income Service (integration)', () => {
  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getIncomeEntries', () => {
    it('returns mapped income entries for a calendar year', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue({
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
      } as any);

      prismaMock.transaction.findMany.mockResolvedValue([
        createMockIncomeTransaction({
          id: 'txn-1',
          date: new Date('2024-01-15'),
          amount: new Decimal('5000.00'),
          category: 'Employment',
        }),
        createMockIncomeTransaction({
          id: 'txn-2',
          date: new Date('2024-02-15'),
          amount: new Decimal('2000.00'),
          category: 'Freelance',
        }),
      ] as any);

      prismaMock.incomeSource.findMany.mockResolvedValue([
        {
          id: 'src-1',
          name: 'Employment',
          description: null,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'src-2',
          name: 'Freelance',
          description: null,
          isActive: true,
          createdAt: new Date(),
        },
      ] as any);

      const result = await getIncomeEntries(calendarYearId, userId, prismaMock);

      expect(result).toHaveLength(2);
      expect(result[0]!.incomeSourceName).toBe('Employment');
      expect(result[0]!.amount).toBe(5000);
      expect(result[1]!.incomeSourceName).toBe('Freelance');
      expect(result[1]!.amount).toBe(2000);
    });

    it('returns [] when calendarYear not found', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue(null);
      const result = await getIncomeEntries(calendarYearId, userId, prismaMock);
      expect(result).toEqual([]);
    });
  });

  describe('addIncomeEntry', () => {
    it('creates a Transaction with correct fields', async () => {
      prismaMock.incomeSource.findUnique.mockResolvedValue({
        id: 'src-1',
        name: 'Employment',
        description: null,
        isActive: true,
        createdAt: new Date(),
      } as any);
      prismaMock.transaction.create.mockResolvedValue(
        createMockIncomeTransaction({ id: 'txn-1', category: 'Employment' }),
      );

      const entry = {
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      };
      const result = await addIncomeEntry(userId, entry, prismaMock);

      expect(prismaMock.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          type: 'CREDIT',
          source: 'USER_MANUAL',
          status: 'CONFIRMED',
          date: entry.dateEarned,
          amount: entry.amount,
          category: 'Employment',
        }),
      });
      expect(result.incomeSourceId).toBe('src-1');
      expect(result.source).toBe('USER_MANUAL');
    });

    it('throws if incomeSource not found', async () => {
      prismaMock.incomeSource.findUnique.mockResolvedValue(null);
      await expect(
        addIncomeEntry(
          userId,
          { dateEarned: new Date(), amount: 100, incomeSourceId: 'bad-id' },
          prismaMock,
        ),
      ).rejects.toThrow('Income source not found');
    });
  });

  describe('updateIncomeEntry', () => {
    it('updates Transaction if source is USER_MANUAL and userId matches', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        source: 'USER_MANUAL',
        userId,
      } as any);
      prismaMock.incomeSource.findUnique.mockResolvedValue({
        id: 'src-1',
        name: 'Employment',
        description: null,
        isActive: true,
        createdAt: new Date(),
      } as any);
      prismaMock.transaction.update.mockResolvedValue({} as any);

      await updateIncomeEntry(
        'txn-1',
        userId,
        {
          dateEarned: new Date('2024-01-15'),
          amount: 1234,
          incomeSourceId: 'src-1',
        },
        prismaMock,
      );

      expect(prismaMock.transaction.update).toHaveBeenCalled();
    });

    it('throws if source is not USER_MANUAL', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        source: 'LLM_CLASSIFIED',
        userId,
      } as any);
      await expect(
        updateIncomeEntry(
          'txn-1',
          userId,
          { dateEarned: new Date(), amount: 1, incomeSourceId: 'src-1' },
          prismaMock,
        ),
      ).rejects.toThrow('Cannot edit an imported income entry');
    });

    it('throws if userId does not match', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        source: 'USER_MANUAL',
        userId: 'other-user',
      } as any);
      await expect(
        updateIncomeEntry(
          'txn-1',
          userId,
          { dateEarned: new Date(), amount: 1, incomeSourceId: 'src-1' },
          prismaMock,
        ),
      ).rejects.toThrow('Income entry not found');
    });
  });

  describe('deleteIncomeEntry', () => {
    it('deletes Transaction if source is USER_MANUAL and userId matches', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        source: 'USER_MANUAL',
        userId,
      } as any);
      prismaMock.transaction.delete.mockResolvedValue({} as any);
      await deleteIncomeEntry('txn-1', userId, prismaMock);
      expect(prismaMock.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
      });
    });

    it('throws if source is not USER_MANUAL', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        source: 'LLM_CLASSIFIED',
        userId,
      } as any);
      await expect(
        deleteIncomeEntry('txn-1', userId, prismaMock),
      ).rejects.toThrow('Cannot delete an imported income entry');
    });

    it('throws if userId does not match', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        source: 'USER_MANUAL',
        userId: 'other-user',
      } as any);
      await expect(
        deleteIncomeEntry('txn-1', userId, prismaMock),
      ).rejects.toThrow('Income entry not found');
    });
  });

  describe('getTotalIncome', () => {
    it('returns sum of CREDIT transactions for year', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue({
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
      } as any);
      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('15000') },
      } as any);
      const total = await getTotalIncome(calendarYearId, userId, prismaMock);
      expect(total).toBe(15000);
    });

    it('returns 0 if calendarYear not found', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue(null);
      const total = await getTotalIncome(calendarYearId, userId, prismaMock);
      expect(total).toBe(0);
    });
  });
});
