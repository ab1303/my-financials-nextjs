import { prisma } from '../utils/prisma';
import type {
  IncomeModel,
  IncomeEntryModel,
  IncomeEntryInput,
  MonthlyIncomeSummary,
  SourceBreakdown,
} from '../models/income';

/**
 * Create Income record for a calendar year and user.
 * No-op stub kept for controller compatibility — IncomeLedger table has been dropped.
 * All income now flows through Transaction (type=CREDIT).
 */
export const addIncomeCalendarYearDetails = async ({
  calendarId,
  userId,
}: Omit<IncomeModel, 'id'>) => {
  // IncomeLedger table removed — Transaction is the source of truth
  return { id: '', calendarId, userId };
};

/**
 * Get Income record by calendar year ID and user ID.
 * Stub kept for controller compatibility — IncomeLedger table has been dropped.
 * Returns a synthetic record so callers don't break.
 */
export const getIncome = async (
  calendarYearId: string,
  userId: string,
): Promise<IncomeModel> => {
  // IncomeLedger table removed — return synthetic record
  return { id: '', calendarId: calendarYearId, userId };
};

/**
 * Get all income entries for a calendar year.
 * Queries Transaction (type=CREDIT, status=CONFIRMED) as the source of truth.
 */
export const getIncomeEntries = async (
  calendarYearId: string,
  userId: string,
  prismaClient = prisma,
  bankAccountId?: string,
): Promise<Array<IncomeEntryModel>> => {
  const calendarYear = await prismaClient.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return [];

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const transactions = await prismaClient.transaction.findMany({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
      ...(bankAccountId ? { bankAccountId } : {}),
    },
    select: { id: true, date: true, amount: true, category: true, source: true },
    orderBy: { date: 'desc' },
  });

  // Batch-resolve category names to IncomeSource IDs
  const allSources = await prismaClient.incomeSource.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const sourceByName = new Map(allSources.map((s) => [s.name.toLowerCase(), s]));

  return transactions.map<IncomeEntryModel>((tx) => {
    const incomeSource = sourceByName.get(tx.category.toLowerCase());
    return {
      id: tx.id,
      dateEarned: tx.date,
      amount: tx.amount.toNumber(),
      incomeSourceId: incomeSource?.id ?? '',
      incomeSourceName: tx.category,
      incomeLedgerId: '',
      source: tx.source,
    };
  });
};

/**
 * Add a new income entry by creating a USER_MANUAL Transaction (CREDIT, CONFIRMED).
 */
export const addIncomeEntry = async (
  userId: string,
  entry: { dateEarned: Date; amount: number; incomeSourceId: string },
  prismaClient = prisma,
) => {
  const incomeSource = await prismaClient.incomeSource.findUnique({
    where: { id: entry.incomeSourceId },
    select: { id: true, name: true },
  });
  if (!incomeSource) throw new Error('Income source not found');

  const created = await prismaClient.transaction.create({
    data: {
      userId,
      type: 'CREDIT',
      source: 'USER_MANUAL',
      status: 'CONFIRMED',
      date: entry.dateEarned,
      amount: entry.amount,
      category: incomeSource.name,
      description: `Manual income: ${incomeSource.name}`,
      bankAccountId: null,
      importSessionId: null,
      confirmedAt: new Date(),
    },
  });

  return {
    id: created.id,
    dateEarned: created.date,
    amount: created.amount, // Decimal — caller calls .toNumber()
    incomeSourceId: incomeSource.id,
    incomeSource: { id: incomeSource.id, name: incomeSource.name },
    incomeLedgerId: '',
    source: 'USER_MANUAL' as const,
  };
};

/**
 * Update an existing manual income entry (Transaction).
 * Guards against editing imported entries and enforces userId ownership.
 */
export const updateIncomeEntry = async (
  entryId: string,
  userId: string,
  entry: Omit<IncomeEntryInput, 'id' | 'incomeLedgerId'>,
  prismaClient = prisma,
) => {
  const existing = await prismaClient.transaction.findUnique({
    where: { id: entryId },
    select: { source: true, userId: true },
  });
  if (!existing) throw new Error('Income entry not found');
  if (existing.userId !== userId) throw new Error('Income entry not found');
  if (existing.source !== 'USER_MANUAL') {
    throw new Error(
      'Cannot edit an imported income entry. Only manually added entries can be modified.',
    );
  }

  const incomeSource = await prismaClient.incomeSource.findUnique({
    where: { id: entry.incomeSourceId },
    select: { name: true },
  });
  if (!incomeSource) throw new Error('Income source not found');

  await prismaClient.transaction.update({
    where: { id: entryId },
    data: {
      date: entry.dateEarned,
      amount: entry.amount,
      category: incomeSource.name,
      description: `Manual income: ${incomeSource.name}`,
    },
  });
};

/**
 * Delete a manual income entry (Transaction).
 * Guards against deleting imported entries and enforces userId ownership.
 */
export const deleteIncomeEntry = async (
  entryId: string,
  userId: string,
  prismaClient = prisma,
) => {
  const existing = await prismaClient.transaction.findUnique({
    where: { id: entryId },
    select: { source: true, userId: true },
  });
  if (!existing) throw new Error('Income entry not found');
  if (existing.userId !== userId) throw new Error('Income entry not found');
  if (existing.source !== 'USER_MANUAL') {
    throw new Error(
      'Cannot delete an imported income entry. Only manually added entries can be deleted.',
    );
  }

  await prismaClient.transaction.delete({ where: { id: entryId } });
};

/**
 * Calculate total income for a calendar year by aggregating CREDIT CONFIRMED Transactions.
 */
export const getTotalIncome = async (
  calendarYearId: string,
  userId: string,
  prismaClient = prisma,
  bankAccountId?: string,
): Promise<number> => {
  const calendarYear = await prismaClient.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return 0;

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const result = await prismaClient.transaction.aggregate({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
      ...(bankAccountId ? { bankAccountId } : {}),
    },
    _sum: { amount: true },
  });

  return result._sum.amount?.toNumber() ?? 0;
};

/**
 * Get monthly income summary for a calendar year.
 * Groups CREDIT CONFIRMED Transactions by month.
 */
export const getMonthlyIncomeSummary = async (
  calendarYearId: string,
  userId: string,
): Promise<Array<MonthlyIncomeSummary>> => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return [];

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true, amount: true },
  });

  // Group by month/year in memory
  const monthlyMap = new Map<string, { totalAmount: number; count: number }>();

  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    const key = `${year}-${month}`;

    const existing = monthlyMap.get(key) ?? { totalAmount: 0, count: 0 };
    monthlyMap.set(key, {
      totalAmount: existing.totalAmount + tx.amount.toNumber(),
      count: existing.count + 1,
    });
  });

  // Convert map to array and sort by year/month DESC
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

  summaries.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return summaries;
};

/**
 * Get income breakdown by source for a specific month/year.
 * Queries CREDIT CONFIRMED Transactions; maps category → source name.
 */
export const getSourceBreakdown = async (
  calendarYearId: string,
  month: number,
  year: number,
  userId: string,
): Promise<Array<SourceBreakdown>> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
    },
    select: { category: true, amount: true },
  });

  // Group by category (income source name)
  const sourceMap = new Map<string, { amount: number; count: number }>();
  let totalAmount = 0;

  transactions.forEach((tx) => {
    const sourceName = tx.category;
    const amount = tx.amount.toNumber();
    totalAmount += amount;

    const existing = sourceMap.get(sourceName) ?? { amount: 0, count: 0 };
    sourceMap.set(sourceName, {
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

  breakdowns.sort((a, b) => b.amount - a.amount);

  return breakdowns;
};

/**
 * Get monthly income summary for a calendar year with optional bank account filter.
 * Extends getMonthlyIncomeSummary to support filtering by FinancialAccount.
 * USER_MANUAL entries (bankAccountId=null) are always included when filter is active.
 */
export const getMonthlyIncomeSummaryFiltered = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
): Promise<Array<MonthlyIncomeSummary>> => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return [];

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
      ...(bankAccountId
        ? { OR: [{ bankAccountId }, { source: 'USER_MANUAL' }] }
        : {}),
    },
    select: { date: true, amount: true },
  });

  const monthlyMap = new Map<string, { totalAmount: number; count: number }>();
  for (const tx of transactions) {
    const month = tx.date.getMonth() + 1;
    const year = tx.date.getFullYear();
    const key = `${year}-${month}`;
    const existing = monthlyMap.get(key) ?? { totalAmount: 0, count: 0 };
    monthlyMap.set(key, {
      totalAmount: existing.totalAmount + tx.amount.toNumber(),
      count: existing.count + 1,
    });
  }

  const summaries: MonthlyIncomeSummary[] = [];
  monthlyMap.forEach((value, key) => {
    const [yearStr, monthStr] = key.split('-');
    summaries.push({
      month: parseInt(monthStr!, 10),
      year: parseInt(yearStr!, 10),
      totalAmount: value.totalAmount,
      entryCount: value.count,
    });
  });

  summaries.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return summaries;
};

/**
 * Get income breakdown by source for a full calendar year with optional bank account filter.
 * Groups CREDIT CONFIRMED Transactions by category (= income source name).
 * USER_MANUAL entries are always included when filter is active.
 */
export const getIncomeSourceBreakdownForYear = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
): Promise<Array<SourceBreakdown>> => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return [];

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
      ...(bankAccountId
        ? { OR: [{ bankAccountId }, { source: 'USER_MANUAL' }] }
        : {}),
    },
    select: { category: true, amount: true },
  });

  const sourceMap = new Map<string, { amount: number; count: number }>();
  let totalAmount = 0;

  for (const tx of transactions) {
    const sourceName = tx.category;
    const amount = tx.amount.toNumber();
    totalAmount += amount;
    const existing = sourceMap.get(sourceName) ?? { amount: 0, count: 0 };
    sourceMap.set(sourceName, { amount: existing.amount + amount, count: existing.count + 1 });
  }

  const breakdowns: SourceBreakdown[] = [];
  sourceMap.forEach((value, sourceKey) => {
    breakdowns.push({
      source: sourceKey,
      amount: value.amount,
      percentage: totalAmount > 0 ? (value.amount / totalAmount) * 100 : 0,
      entryCount: value.count,
    });
  });

  breakdowns.sort((a, b) => b.amount - a.amount);
  return breakdowns;
};

