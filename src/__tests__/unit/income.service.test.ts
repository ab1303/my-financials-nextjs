import { beforeEach, describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  addIncomeEntry,
  getIncomeEntries,
} from '@/server/services/income.service';
import { createMockContext, type MockContext } from '../helpers/mock-context';

describe('Income Service - Phase 3', () => {
  let mockCtx: MockContext;

  beforeEach(() => {
    mockCtx = createMockContext();
  });

  const userId = 'test-user-id';
  const calendarYearId = 'test-calendar-id';
  const incomeId = 'test-income-id';

  it('addIncomeEntry saves with valid incomeSourceId', async () => {
    const entryData = {
      dateEarned: new Date('2024-01-15'),
      amount: 5000,
      incomeSourceId: 'income-source-id-1',
    };

    mockCtx.prisma.incomeRecord.create.mockResolvedValue({
      id: 'new-entry-id',
      incomeLedgerId: incomeId,
      dateEarned: entryData.dateEarned,
      amount: new Decimal('5000.00'),
      incomeSourceId: entryData.incomeSourceId,
      incomeSource: {
        id: entryData.incomeSourceId,
        name: 'Employment',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await addIncomeEntry(incomeId, entryData, mockCtx.prisma);

    expect(mockCtx.prisma.incomeRecord.create).toHaveBeenCalledWith({
      data: {
        incomeLedgerId: incomeId,
        dateEarned: entryData.dateEarned,
        amount: entryData.amount,
        incomeSourceId: entryData.incomeSourceId,
      },
      include: {
        incomeSource: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  it('addIncomeEntry result includes incomeSourceName from relation', async () => {
    mockCtx.prisma.incomeRecord.create.mockResolvedValue({
      id: 'new-entry-id',
      incomeLedgerId: incomeId,
      dateEarned: new Date('2024-01-15'),
      amount: new Decimal('5000.00'),
      incomeSourceId: 'income-source-id-1',
      incomeSource: {
        id: 'income-source-id-1',
        name: 'Employment',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await addIncomeEntry(
      incomeId,
      {
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'income-source-id-1',
      },
      mockCtx.prisma,
    );

    expect(result.incomeSourceName).toBe('Employment');
    expect(result.incomeSource.id).toBe('income-source-id-1');
  });

  it('getIncomeEntries returns incomeSourceId and incomeSourceName in each entry', async () => {
    mockCtx.prisma.incomeRecord.findMany.mockResolvedValue([
      {
        id: 'entry-1',
        incomeLedgerId: incomeId,
        dateEarned: new Date('2024-01-15'),
        amount: new Decimal('5000.00'),
        incomeSourceId: 'income-source-id-1',
        incomeSource: {
          id: 'income-source-id-1',
          name: 'Employment',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        incomeLedger: {
          id: incomeId,
          calendarId: calendarYearId,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ] as never);

    const result = await getIncomeEntries(
      calendarYearId,
      userId,
      mockCtx.prisma,
    );

    expect(result).toEqual([
      {
        id: 'entry-1',
        dateEarned: new Date('2024-01-15'),
        amount: 5000,
        incomeSourceId: 'income-source-id-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: incomeId,
      },
    ]);
    expect(mockCtx.prisma.incomeRecord.findMany).toHaveBeenCalledWith({
      where: {
        incomeLedger: {
          calendarId: calendarYearId,
          userId,
        },
      },
      include: {
        incomeLedger: true,
        incomeSource: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        dateEarned: 'desc',
      },
    });
  });
});
