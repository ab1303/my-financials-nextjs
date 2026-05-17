import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Create mock IncomeLedger (per-calendar-year income container)
 */
export const createMockIncomeLedger = (
  overrides?: Partial<
    Prisma.IncomeLedgerGetPayload<{
      include: { records: true };
    }>
  >,
): Prisma.IncomeLedgerGetPayload<{
  include: { records: true };
}> => ({
  id: 'test-income-id',
  userId: 'test-user-id',
  calendarId: 'test-calendar-id',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  records: [
    {
      id: 'test-entry-id-1',
      incomeLedgerId: 'test-income-id',
      amount: new Decimal('5000.00'),
      dateEarned: new Date('2024-01-15'),
      source: 'EMPLOYMENT' as const,
      transactionId: null,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'test-entry-id-2',
      incomeLedgerId: 'test-income-id',
      amount: new Decimal('5000.00'),
      dateEarned: new Date('2024-02-15'),
      source: 'EMPLOYMENT' as const,
      transactionId: null,
      createdAt: new Date('2024-02-15'),
      updatedAt: new Date('2024-02-15'),
    },
  ],
  ...overrides,
});

/**
 * Create mock IncomeRecord (individual income event)
 */
export const createMockIncomeEntry = (
  overrides?: Partial<Prisma.IncomeRecordGetPayload<Record<string, never>>>,
): Prisma.IncomeRecordGetPayload<Record<string, never>> => ({
  id: 'test-entry-id',
  incomeLedgerId: 'test-income-id',
  amount: new Decimal('1000.00'),
  dateEarned: new Date('2024-01-01'),
  source: 'EMPLOYMENT' as const,
  transactionId: null,
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
