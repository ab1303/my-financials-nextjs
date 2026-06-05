import { beforeEach, describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  addIncomeEntry,
  getIncomeEntries,
  updateIncomeEntry,
  deleteIncomeEntry,
} from '@/server/services/income.service';
import { createMockContext, type MockContext } from '../helpers/mock-context';
import { createMockIncomeTransaction } from '../mocks/income.mock';

describe('Income Service (unit, with MockContext)', () => {
  let mockCtx: MockContext;
  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';

  beforeEach(() => {
    mockCtx = createMockContext();
  });

  it('addIncomeEntry saves Transaction with correct fields', async () => {
    mockCtx.prisma.incomeSource.findUnique.mockResolvedValue({
      id: 'src-1',
      name: 'Employment',
      description: null,
      isActive: true,
      createdAt: new Date(),
    } as any);
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
      id: 'src-1',
      name: 'Employment',
      description: null,
      isActive: true,
      createdAt: new Date(),
    } as any);
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
    mockCtx.prisma.calendarYear.findUnique.mockResolvedValue({
      fromYear: 2024,
      fromMonth: 1,
      toYear: 2024,
      toMonth: 12,
    } as any);

    mockCtx.prisma.transaction.findMany.mockResolvedValue([
      createMockIncomeTransaction({
        id: 'txn-1',
        date: new Date('2024-01-15'),
        amount: new Decimal('5000.00'),
        category: 'Employment',
      }),
    ] as any);

    mockCtx.prisma.incomeSource.findMany.mockResolvedValue([
      { id: 'src-1', name: 'Employment', isActive: true },
    ] as any);

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
    mockCtx.prisma.calendarYear.findUnique.mockResolvedValue({
      fromYear: 2024,
      fromMonth: 1,
      toYear: 2024,
      toMonth: 12,
    } as any);
    mockCtx.prisma.transaction.findMany.mockResolvedValue([] as any);
    mockCtx.prisma.incomeSource.findMany.mockResolvedValue([] as any);

    await getIncomeEntries(calendarYearId, userId, mockCtx.prisma);

    const whereArg = mockCtx.prisma.transaction.findMany.mock
      .calls[0]![0] as any;
    expect(whereArg.where.category).toEqual({
      notIn: ['Transfer', 'Reimbursement'],
    });
  });

  it('getIncomeEntries excludes Reimbursement-category credits from income', async () => {
    mockCtx.prisma.calendarYear.findUnique.mockResolvedValue({
      fromYear: 2024,
      fromMonth: 1,
      toYear: 2024,
      toMonth: 12,
    } as any);
    mockCtx.prisma.transaction.findMany.mockResolvedValue([] as any);
    mockCtx.prisma.incomeSource.findMany.mockResolvedValue([] as any);

    await getIncomeEntries(calendarYearId, userId, mockCtx.prisma);

    const whereArg = mockCtx.prisma.transaction.findMany.mock
      .calls[0]![0] as any;
    // Reimbursements are expense offsets (split payments), not earned income
    expect(whereArg.where.category.notIn).toContain('Reimbursement');
    expect(whereArg.where.category.notIn).toContain('Transfer');
  });

  it('updateIncomeEntry updates Transaction correctly', async () => {
    mockCtx.prisma.transaction.findUnique.mockResolvedValue({
      source: 'USER_MANUAL',
      userId,
    } as any);
    mockCtx.prisma.incomeSource.findUnique.mockResolvedValue({
      name: 'Employment',
    } as any);
    mockCtx.prisma.transaction.update.mockResolvedValue({} as any);

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
    mockCtx.prisma.transaction.findUnique.mockResolvedValue({
      source: 'USER_MANUAL',
      userId,
    } as any);
    mockCtx.prisma.transaction.delete.mockResolvedValue({} as any);
    await deleteIncomeEntry('txn-1', userId, mockCtx.prisma);
    expect(mockCtx.prisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'txn-1' },
    });
  });
});
