import type { CalendarYear, IncomeSource, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  addIncomeEntry,
  deleteIncomeEntry,
  getIncomeEntries,
  updateIncomeEntry,
} from '@/server/services/income.service';

import { createMockContext, type MockContext } from '../helpers/mock-context';
import { createMockIncomeTransaction } from '../mocks/income.mock';

type TransactionFindManyArgs = { where?: Prisma.TransactionWhereInput };

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

const getCategoryFilter = (
  args: TransactionFindManyArgs | undefined,
): Prisma.StringFilter<'Transaction'> | undefined => {
  const category = args?.where?.category;
  if (
    typeof category === 'object' &&
    category !== null &&
    'notIn' in category
  ) {
    return category as Prisma.StringFilter<'Transaction'>;
  }
  return undefined;
};

describe('Income Service (unit, with MockContext)', () => {
  let mockCtx: MockContext;
  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';

  beforeEach(() => {
    mockCtx = createMockContext();
  });

  it('addIncomeEntry saves Transaction with correct fields', async () => {
    mockCtx.prisma.incomeSource.findUnique.mockResolvedValue({
      ...createIncomeSource(),
    });
    mockCtx.prisma.transaction.create.mockResolvedValue(
      createMockIncomeTransaction({ id: 'txn-1', category: 'Employment' }),
    );

    await addIncomeEntry(
      userId,
      {
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      },
      mockCtx.prisma,
    );

    expect(mockCtx.prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        type: 'CREDIT',
        source: 'USER_MANUAL',
        status: 'CONFIRMED',
        date: new Date('2024-01-15'),
        amount: 5000,
        category: 'Employment',
      }),
    });
  });

  it('addIncomeEntry result includes incomeSource data', async () => {
    mockCtx.prisma.incomeSource.findUnique.mockResolvedValue({
      ...createIncomeSource(),
    });
    mockCtx.prisma.transaction.create.mockResolvedValue(
      createMockIncomeTransaction({ id: 'txn-1', category: 'Employment' }),
    );

    const result = await addIncomeEntry(
      userId,
      {
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'src-1',
      },
      mockCtx.prisma,
    );

    expect(result.incomeSourceId).toBe('src-1');
    expect(result.source).toBe('USER_MANUAL');
  });

  it('getIncomeEntries returns entries mapped from Transactions', async () => {
    mockCtx.prisma.calendarYear.findUnique.mockResolvedValue(
      createCalendarYear(),
    );

    mockCtx.prisma.transaction.findMany.mockResolvedValue([
      createMockIncomeTransaction({
        id: 'txn-1',
        date: new Date('2024-01-15'),
        amount: new Decimal('5000.00'),
        category: 'Employment',
      }),
    ]);

    mockCtx.prisma.incomeSource.findMany.mockResolvedValue([
      createIncomeSource({ id: 'src-1', name: 'Employment' }),
    ]);

    const result = await getIncomeEntries(
      calendarYearId,
      userId,
      mockCtx.prisma,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.incomeSourceName).toBe('Employment');
    expect(result[0]!.amount).toBe(5000);
  });

  it('getIncomeEntries excludes Transfer-category credits from income', async () => {
    mockCtx.prisma.calendarYear.findUnique.mockResolvedValue(
      createCalendarYear(),
    );
    mockCtx.prisma.transaction.findMany.mockResolvedValue([]);
    mockCtx.prisma.incomeSource.findMany.mockResolvedValue([]);

    await getIncomeEntries(calendarYearId, userId, mockCtx.prisma);

    const whereArg = mockCtx.prisma.transaction.findMany.mock
      .calls[0]![0] as TransactionFindManyArgs;
    const categoryFilter = getCategoryFilter(whereArg);
    expect(categoryFilter).toEqual({
      notIn: ['Transfer', 'Reimbursement'],
    });
  });

  it('getIncomeEntries excludes Reimbursement-category credits from income', async () => {
    mockCtx.prisma.calendarYear.findUnique.mockResolvedValue(
      createCalendarYear(),
    );
    mockCtx.prisma.transaction.findMany.mockResolvedValue([]);
    mockCtx.prisma.incomeSource.findMany.mockResolvedValue([]);

    await getIncomeEntries(calendarYearId, userId, mockCtx.prisma);

    const whereArg = mockCtx.prisma.transaction.findMany.mock
      .calls[0]![0] as TransactionFindManyArgs;
    const categoryFilter = getCategoryFilter(whereArg);
    // Reimbursements are expense offsets (split payments), not earned income
    expect(categoryFilter?.notIn).toContain('Reimbursement');
    expect(categoryFilter?.notIn).toContain('Transfer');
  });

  it('updateIncomeEntry updates Transaction correctly', async () => {
    mockCtx.prisma.transaction.findUnique.mockResolvedValue(
      createMockIncomeTransaction({ source: 'USER_MANUAL', userId }),
    );
    mockCtx.prisma.incomeSource.findUnique.mockResolvedValue(
      createIncomeSource({ name: 'Employment' }),
    );
    mockCtx.prisma.transaction.update.mockResolvedValue(
      createMockIncomeTransaction({ id: 'txn-1' }),
    );

    await updateIncomeEntry(
      'txn-1',
      userId,
      {
        dateEarned: new Date('2024-01-15'),
        amount: 1234,
        incomeSourceId: 'src-1',
      },
      mockCtx.prisma,
    );

    expect(mockCtx.prisma.transaction.update).toHaveBeenCalled();
  });

  it('deleteIncomeEntry deletes Transaction correctly', async () => {
    mockCtx.prisma.transaction.findUnique.mockResolvedValue(
      createMockIncomeTransaction({ source: 'USER_MANUAL', userId }),
    );
    mockCtx.prisma.transaction.delete.mockResolvedValue(
      createMockIncomeTransaction({ id: 'txn-1' }),
    );
    await deleteIncomeEntry('txn-1', userId, mockCtx.prisma);
    expect(mockCtx.prisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'txn-1' },
    });
  });
});
