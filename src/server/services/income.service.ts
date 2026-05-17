import { prisma } from '../utils/prisma';
import type {
  IncomeModel,
  IncomeEntryModel,
  IncomeEntryInput,
  MonthlyIncomeSummary,
  SourceBreakdown,
} from '../models/income';
import type { Prisma } from '@prisma/client';

/**
 * Create Income record for a calendar year and user
 * @param calendarId - Calendar year ID (typically FISCAL type)
 * @param userId - User ID for ownership
 * @returns Created Income record
 */
export const addIncomeCalendarYearDetails = async ({
  calendarId,
  userId,
}: Omit<IncomeModel, 'id'>) => {
  return await prisma.incomeLedger.create({
    data: {
      calendarId,
      userId,
    },
  });
};

/**
 * Get Income record by calendar year ID and user ID
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Income record or empty object if not found
 */
export const getIncome = async (
  calendarYearId: string,
  userId: string,
): Promise<IncomeModel> => {
  const income = await prisma.incomeLedger.findUnique({
    where: {
      calendarId_userId: {
        calendarId: calendarYearId,
        userId,
      },
    },
  });

  if (!income)
    return {
      id: '',
      calendarId: calendarYearId,
      userId,
    };

  return {
    id: income.id,
    calendarId: income.calendarId,
    userId: income.userId,
  };
};

/**
 * Get all income entries for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param prismaClient - Optional Prisma client for dependency injection (defaults to global instance)
 * @returns Array of income entries
 */
export const getIncomeEntries = async (
  calendarYearId: string,
  userId: string,
  prismaClient = prisma,
): Promise<Array<IncomeEntryModel>> => {
  // The incomeLedger.calendarId association is the source of truth for FY membership.
  // A secondary dateEarned filter is intentionally omitted here to prevent "orphaned" entries
  // (entries that were saved to a ledger before a toMonth correction would become invisible).
  // The addRow server action enforces the date boundary on write.
  const where: Prisma.IncomeRecordWhereInput = {
    incomeLedger: {
      calendarId: calendarYearId,
      userId,
    },
  };

  const incomeEntries = await prismaClient.incomeRecord.findMany({
    where,
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

  return incomeEntries.map<IncomeEntryModel>((entry) => ({
    id: entry.id,
    dateEarned: entry.dateEarned,
    amount: entry.amount.toNumber(),
    incomeSourceId: entry.incomeSourceId,
    incomeSourceName: entry.incomeSource.name,
    incomeLedgerId: entry.incomeLedgerId,
  }));
};

/**
 * Add a new income entry to an Income record
 * @param incomeId - Parent Income record ID
 * @param entry - Income entry data
 * @param prismaClient - Optional Prisma client for dependency injection (defaults to global instance)
 * @returns Created IncomeEntry record
 */
export const addIncomeEntry = async (
  incomeId: string,
  entry: Omit<IncomeEntryInput, 'id' | 'incomeLedgerId'>,
  prismaClient = prisma,
) => {
  const createdEntry = await prismaClient.incomeRecord.create({
    data: {
      incomeLedgerId: incomeId,
      dateEarned: entry.dateEarned,
      amount: entry.amount,
      incomeSourceId: entry.incomeSourceId,
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

  return {
    ...createdEntry,
    incomeSourceName: createdEntry.incomeSource.name,
  };
};

/**
 * Update an existing income entry
 * @param entryId - IncomeEntry ID to update
 * @param entry - Updated income entry data
 * @param prismaClient - Optional Prisma client for dependency injection (defaults to global instance)
 */
export const updateIncomeEntry = async (
  entryId: string,
  entry: Omit<IncomeEntryInput, 'id' | 'incomeLedgerId'>,
  prismaClient = prisma,
) => {
  const where: Prisma.IncomeRecordWhereUniqueInput = {
    id: entryId,
  };

  await prismaClient.incomeRecord.update({
    where,
    data: {
      dateEarned: entry.dateEarned,
      amount: entry.amount,
      incomeSourceId: entry.incomeSourceId,
    },
  });
};

/**
 * Delete an income entry
 * @param entryId - IncomeEntry ID to delete
 * @param prismaClient - Optional Prisma client for dependency injection (defaults to global instance)
 */
export const deleteIncomeEntry = async (
  entryId: string,
  prismaClient = prisma,
) => {
  await prismaClient.incomeRecord.delete({
    where: {
      id: entryId,
    },
  });
};

/**
 * Calculate total income for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param prismaClient - Optional Prisma client for dependency injection (defaults to global instance)
 * @returns Total income amount
 */
export const getTotalIncome = async (
  calendarYearId: string,
  userId: string,
  prismaClient = prisma,
): Promise<number> => {
  // Same rationale as getIncomeEntries: ledger membership is the source of truth.
  const where: Prisma.IncomeRecordWhereInput = {
    incomeLedger: {
      calendarId: calendarYearId,
      userId,
    },
  };

  const result = await prismaClient.incomeRecord.aggregate({
    where,
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount?.toNumber() ?? 0;
};

/**
 * Get monthly income summary for a calendar year
 * Aggregates income entries by month/year with totals
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Array of monthly summaries
 */
export const getMonthlyIncomeSummary = async (
  calendarYearId: string,
  userId: string,
): Promise<Array<MonthlyIncomeSummary>> => {
  // Fetch all entries for the calendar year
  const entries = await prisma.incomeRecord.findMany({
    where: {
      incomeLedger: {
        calendarId: calendarYearId,
        userId,
      },
    },
    select: {
      dateEarned: true,
      amount: true,
    },
  });

  // Group by month/year in memory
  const monthlyMap = new Map<string, { totalAmount: number; count: number }>();

  entries.forEach((entry) => {
    const date = new Date(entry.dateEarned);
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    const key = `${year}-${month}`;

    const existing = monthlyMap.get(key) ?? { totalAmount: 0, count: 0 };
    monthlyMap.set(key, {
      totalAmount: existing.totalAmount + entry.amount.toNumber(),
      count: existing.count + 1,
    });
  });

  // Convert map to array and sort by year/month
  const summaries: MonthlyIncomeSummary[] = [];
  monthlyMap.forEach((value, key) => {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);
    summaries.push({
      month,
      year,
      totalAmount: value.totalAmount,
      entryCount: value.count,
    });
  });

  // Sort by year DESC, then month DESC
  summaries.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return summaries;
};

/**
 * Get income breakdown by source for a specific month/year
 * @param calendarYearId - Calendar year ID
 * @param month - Month (1-12)
 * @param year - Year (e.g., 2024)
 * @param userId - User ID for ownership verification
 * @returns Array of source breakdowns with percentages
 */
export const getSourceBreakdown = async (
  calendarYearId: string,
  month: number,
  year: number,
  userId: string,
): Promise<Array<SourceBreakdown>> => {
  // Calculate date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch entries for the specific month
  const entries = await prisma.incomeRecord.findMany({
    where: {
      incomeLedger: {
        calendarId: calendarYearId,
        userId,
      },
      dateEarned: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      incomeSource: {
        select: {
          name: true,
        },
      },
      amount: true,
    },
  });

  // Group by source
  const sourceMap = new Map<string, { amount: number; count: number }>();
  let totalAmount = 0;

  entries.forEach((entry) => {
    const source = entry.incomeSource.name;
    const amount = entry.amount.toNumber();
    totalAmount += amount;

    const existing = sourceMap.get(source) ?? { amount: 0, count: 0 };
    sourceMap.set(source, {
      amount: existing.amount + amount,
      count: existing.count + 1,
    });
  });

  // Convert to array with percentages
  const breakdowns: SourceBreakdown[] = [];
  sourceMap.forEach((value, sourceKey) => {
    breakdowns.push({
      source: sourceKey,
      amount: value.amount,
      percentage: totalAmount > 0 ? (value.amount / totalAmount) * 100 : 0,
      entryCount: value.count,
    });
  });

  // Sort by amount descending
  breakdowns.sort((a, b) => b.amount - a.amount);

  return breakdowns;
};
