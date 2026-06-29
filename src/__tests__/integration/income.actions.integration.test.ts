import type { CalendarYear, IncomeSource } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addRow,
  deleteRow,
  editRow,
} from '@/app/(authorized)/cashflow/income/actions';

import { mockSession } from '../mocks/auth.mock';
import { createMockIncomeTransaction } from '../mocks/income.mock';
import { prismaMock } from '../mocks/prisma.mock';

type AuthMock = {
  mockResolvedValue: (value: unknown) => void;
};

const setAuthMock = (value: unknown) => {
  (auth as unknown as AuthMock).mockResolvedValue(value);
};

const createIncomeSource = (
  overrides?: Partial<IncomeSource>,
): IncomeSource => ({
  id: 'src-1',
  name: 'Employment',
  description: null,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const createCalendarYear = (
  overrides?: Partial<CalendarYear>,
): CalendarYear => ({
  id: 'cal-1',
  description: 'FY 2024',
  fromYear: 2024,
  fromMonth: 1,
  toYear: 2024,
  toMonth: 12,
  type: null,
  lockedAt: null,
  ...overrides,
});

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

  beforeEach(() => {
    vi.clearAllMocks();
    setAuthMock(mockSession);
  });

  describe('addRow', () => {
    it('successfully adds an income entry', async () => {
      prismaMock.calendarYear.findUnique.mockResolvedValue(
        createCalendarYear(),
      );
      prismaMock.incomeSource.findUnique.mockResolvedValue(
        createIncomeSource(),
      );
      prismaMock.transaction.create.mockResolvedValue(
        createMockIncomeTransaction({ id: 'txn-1', category: 'Employment' }),
      );

      const input = {
        calendarYearId,
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      };

      const result = await addRow(input);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(5000);
      expect(result.data?.source).toBe('USER_MANUAL');
      expect(revalidatePath).toHaveBeenCalledWith('/cashflow/income');
    });

    it('returns error when user is not authenticated', async () => {
      setAuthMock(null);

      const input = {
        calendarYearId,
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      };

      const result = await addRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('validates input data', async () => {
      const invalidInput = {
        calendarYearId: '',
        dateEarned: new Date('2024-01-15'),
        amount: -100,
        incomeSourceId: '',
      };

      const result = await addRow(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('editRow', () => {
    it('successfully updates an income entry', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...createMockIncomeTransaction({ source: 'USER_MANUAL', userId }),
      });
      prismaMock.incomeSource.findUnique.mockResolvedValue(
        createIncomeSource(),
      );
      prismaMock.transaction.update.mockResolvedValue(
        createMockIncomeTransaction({ id: 'txn-1' }),
      );

      const input = {
        id: 'txn-1',
        dateEarned: new Date('2024-02-15'),
        amount: 6000,
        incomeSourceId: 'src-1',
      };

      const result = await editRow(input);

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/cashflow/income');
    });

    it('returns error when user is not authenticated', async () => {
      setAuthMock(null);

      const input = {
        id: 'txn-1',
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      };

      const result = await editRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('returns error when entry not found', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(null);

      const input = {
        id: 'bad-id',
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      };

      const result = await editRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error when cannot edit imported entry', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...createMockIncomeTransaction({ source: 'LLM_CLASSIFIED', userId }),
      });

      const input = {
        id: 'txn-1',
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      };

      const result = await editRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('imported income entry');
    });
  });

  describe('deleteRow', () => {
    it('successfully deletes an income entry', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...createMockIncomeTransaction({ source: 'USER_MANUAL', userId }),
      });
      prismaMock.transaction.delete.mockResolvedValue(
        createMockIncomeTransaction({ id: 'txn-1' }),
      );

      const input = { id: 'txn-1' };

      const result = await deleteRow(input);

      expect(result.success).toBe(true);
      expect(prismaMock.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
      });
      expect(revalidatePath).toHaveBeenCalledWith('/cashflow/income');
    });

    it('returns error when user is not authenticated', async () => {
      setAuthMock(null);

      const input = { id: 'txn-1' };

      const result = await deleteRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('returns error when entry not found', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(null);

      const input = { id: 'bad-id' };

      const result = await deleteRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error when cannot delete imported entry', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...createMockIncomeTransaction({ source: 'LLM_CLASSIFIED', userId }),
      });

      const input = { id: 'txn-1' };

      const result = await deleteRow(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('imported income entry');
    });
  });
});
