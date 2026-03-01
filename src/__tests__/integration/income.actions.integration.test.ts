import { describe, it, expect, beforeEach, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { Decimal } from '@prisma/client/runtime/library';
import {
  addRow,
  editRow,
  deleteRow,
} from '@/app/(authorized)/cashflow/income/actions';
import { prismaMock } from '../mocks/prisma.mock';
import { mockSession } from '../mocks/auth.mock';
import { createMockIncomeEntry } from '../mocks/income.mock';

// Mock auth function
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from '@/server/auth';

describe('Income Server Actions', () => {
  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';
  const incomeId = 'test-income-id';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authenticated session
    vi.mocked(auth).mockResolvedValue(mockSession);
  });

  describe('addRow', () => {
    it('should successfully add an income entry', async () => {
      const input = {
        calendarYearId,
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        source: 'EMPLOYMENT' as const,
      };

      // Mock Income lookup/creation
      prismaMock.income.findUnique.mockResolvedValue({
        id: incomeId,
        calendarId: calendarYearId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock IncomeEntry creation
      const mockEntry = {
        id: 'new-entry-id',
        incomeId,
        dateEarned: input.dateEarned,
        amount: new Decimal('5000.00'),
        source: input.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.incomeEntry.create.mockResolvedValue(mockEntry);

      const result = await addRow(input);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(5000);
      expect(result.data?.source).toBe('EMPLOYMENT');
      expect(revalidatePath).toHaveBeenCalledWith('/cashflow/income');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const input = {
        calendarYearId,
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        source: 'EMPLOYMENT' as const,
      };

      const result = await addRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should validate input data', async () => {
      const invalidInput = {
        calendarYearId: '',
        dateEarned: new Date('2024-01-15'),
        amount: -100, // Invalid negative amount
        source: 'EMPLOYMENT' as const,
      };

      const result = await addRow(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid data');
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

      prismaMock.income.findUnique.mockResolvedValue({
        id: incomeId,
        calendarId: calendarYearId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const source of sources) {
        const input = {
          calendarYearId,
          dateEarned: new Date('2024-01-15'),
          amount: 1000,
          source,
        };

        const mockEntry = createMockIncomeEntry({
          source,
          amount: new Decimal('1000.00'),
        });
        prismaMock.incomeEntry.create.mockResolvedValue(mockEntry);

        const result = await addRow(input);

        expect(result.success).toBe(true);
        expect(result.data?.source).toBe(source);
      }
    });
  });

  describe('editRow', () => {
    it('should successfully update an income entry', async () => {
      const entryId = 'entry-to-update';
      const input = {
        id: entryId,
        dateEarned: new Date('2024-02-15'),
        amount: 6000,
        source: 'BUSINESS' as const,
      };

      const mockUpdatedEntry = {
        id: entryId,
        incomeId,
        dateEarned: input.dateEarned,
        amount: new Decimal('6000.00'),
        source: input.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.incomeEntry.update.mockResolvedValue(mockUpdatedEntry);

      const result = await editRow(input);

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/cashflow/income');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const input = {
        id: 'entry-id',
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        source: 'EMPLOYMENT' as const,
      };

      const result = await editRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should handle entry not found', async () => {
      const input = {
        id: 'non-existent-id',
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        source: 'EMPLOYMENT' as const,
      };

      prismaMock.incomeEntry.update.mockRejectedValue(
        new Error('Record to update not found'),
      );

      const result = await editRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('deleteRow', () => {
    it('should successfully delete an income entry', async () => {
      const entryId = 'entry-to-delete';
      const input = { id: entryId };

      const mockDeletedEntry = createMockIncomeEntry({ id: entryId });
      prismaMock.incomeEntry.delete.mockResolvedValue(mockDeletedEntry);

      const result = await deleteRow(input);

      expect(result.success).toBe(true);
      expect(prismaMock.incomeEntry.delete).toHaveBeenCalledWith({
        where: { id: entryId },
      });
      expect(revalidatePath).toHaveBeenCalledWith('/cashflow/income');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const input = { id: 'entry-id' };

      const result = await deleteRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should handle entry not found', async () => {
      const input = { id: 'non-existent-id' };

      prismaMock.incomeEntry.delete.mockRejectedValue(
        new Error('Record to delete not found'),
      );

      const result = await deleteRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate input schema', async () => {
      const invalidInput = { id: '' }; // Empty ID

      const result = await deleteRow(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });
});
