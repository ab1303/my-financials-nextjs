import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Create mock Income with IncomeEntry records
 */
export const createMockIncome = (
  overrides?: Partial<
    Prisma.IncomeGetPayload<{
      include: { entries: true };
    }>
  >,
): Prisma.IncomeGetPayload<{
  include: { entries: true };
}> => ({
  id: 'test-income-id',
  userId: 'test-user-id',
  source: 'EMPLOYMENT',
  description: 'Test Employment Income',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  entries: [
    {
      id: 'test-entry-id-1',
      incomeId: 'test-income-id',
      amount: new Decimal('5000.00'),
      date: new Date('2024-01-15'),
      notes: 'January salary',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'test-entry-id-2',
      incomeId: 'test-income-id',
      amount: new Decimal('5000.00'),
      date: new Date('2024-02-15'),
      notes: 'February salary',
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-02-15'),
    },
  ],
  ...overrides,
});

/**
 * Create mock IncomeEntry
 */
export const createMockIncomeEntry = (
  overrides?: Partial<Prisma.IncomeEntryGetPayload<Record<string, never>>>,
): Prisma.IncomeEntryGetPayload<Record<string, never>> => ({
  id: 'test-entry-id',
  incomeId: 'test-income-id',
  amount: new Decimal('1000.00'),
  date: new Date('2024-01-01'),
  notes: 'Test income entry',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Create mock monthly summary data
 */
export const createMockMonthlySummary = () => ({
  month: '2024-01',
  totalAmount: new Decimal('10000.00'),
  entryCount: 2,
});

/**
 * Create mock source breakdown data
 */
export const createMockSourceBreakdown = () => ({
  source: 'EMPLOYMENT',
  amount: new Decimal('5000.00'),
  count: 1,
});
