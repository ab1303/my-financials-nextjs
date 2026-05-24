import { prisma } from '../utils/prisma';
import type {
  ExpenseModel,
  ExpenseEntryModel,
  ExpenseEntryInput,
  ExpenseEntryWithCategory,
  MonthlyExpenseSummary,
  CategoryBreakdown,
} from '../models/expense';
import type { Prisma } from '@prisma/client';

/**
 * Create Expense record for a calendar year and user
 * @param calendarId - Calendar year ID (typically FISCAL type)
 * @param userId - User ID for ownership
 * @returns Created Expense record
 */
export const addExpenseCalendarYearDetails = async ({
  calendarId,
  userId,
}: Omit<ExpenseModel, 'id'>) => {
  return await prisma.expenseLedger.create({
    data: {
      calendarId,
      userId,
    },
  });
};

/**
 * Get Expense record by calendar year ID and user ID
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Expense record or empty object if not found
 */
export const getExpense = async (
  calendarYearId: string,
  userId: string,
): Promise<ExpenseModel> => {
  const expense = await prisma.expenseLedger.findUnique({
    where: {
      calendarId_userId: {
        calendarId: calendarYearId,
        userId,
      },
    },
  });

  if (!expense)
    return {
      id: '',
      calendarId: calendarYearId,
      userId,
    };

  return {
    id: expense.id,
    calendarId: expense.calendarId,
    userId: expense.userId,
  };
};

/**
 * Get all expense entries for a calendar year with category names
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param prismaClient - Optional Prisma client for dependency injection (defaults to global instance)
 * @returns Array of expense entries with category information
 */
export const getExpenseEntries = async (
  calendarYearId: string,
  userId: string,
  prismaClient = prisma,
): Promise<Array<ExpenseEntryWithCategory>> => {
  const where: Partial<Prisma.MonthlyExpenseSummaryWhereInput> = {
    expenseLedger: {
      calendarId: calendarYearId,
      userId,
    },
  };

  const expenseEntries = await prismaClient.monthlyExpenseSummary.findMany({
    where,
    include: {
      expenseLedger: true,
      category: true,
    },
    orderBy: [{ month: 'asc' }, { category: { name: 'asc' } }],
  });

  return expenseEntries.map<ExpenseEntryWithCategory>((entry) => ({
    id: entry.id,
    month: entry.month,
    amount: entry.amount.toNumber(),
    categoryId: entry.categoryId,
    expenseLedgerId: entry.expenseLedgerId,
    categoryName: entry.category.name,
  }));
};

/**
 * Get expense entries for a specific month, derived from Transaction table (source of truth).
 * - USER_MANUAL transactions are returned as individual editable entries (id = transaction.id).
 * - Bank-imported transactions are aggregated per category into a single read-only entry.
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param month - Month number (1-12)
 * @returns Array of per-entry expense aggregates for the specified month
 */
export const getExpenseEntriesForMonth = async (
  calendarYearId: string,
  userId: string,
  month: number,
): Promise<Array<ExpenseEntryWithCategory>> => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });

  if (!calendarYear) return [];

  // Determine the calendar year for this month within the fiscal year.
  // Months >= fromMonth are in fromYear; months < fromMonth are in toYear.
  const year = month >= calendarYear.fromMonth ? calendarYear.fromYear : calendarYear.toYear;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
    },
    select: { id: true, category: true, amount: true, source: true },
    orderBy: { date: 'asc' },
  });

  // Separate USER_MANUAL from bank-imported transactions
  const userManualTxs = transactions.filter((tx) => tx.source === 'USER_MANUAL');
  const bankTxs = transactions.filter((tx) => tx.source !== 'USER_MANUAL');

  // Aggregate bank transactions by category name
  const bankCategoryMap = new Map<string, number>();
  for (const tx of bankTxs) {
    if (!tx.category) continue;
    bankCategoryMap.set(tx.category, (bankCategoryMap.get(tx.category) ?? 0) + Number(tx.amount));
  }

  // Resolve category IDs by name for all entries
  const allCategoryNames = [
    ...Array.from(bankCategoryMap.keys()),
    ...userManualTxs.filter((tx) => tx.category).map((tx) => tx.category as string),
  ];
  const expenseCategories = await prisma.expenseCategory.findMany({
    where: { name: { in: allCategoryNames } },
    select: { id: true, name: true },
  });
  const catNameToId = new Map(expenseCategories.map((c) => [c.name, c.id]));

  const entries: ExpenseEntryWithCategory[] = [];

  // Bank-imported entries: one aggregate row per category, read-only
  for (const [categoryName, amount] of bankCategoryMap.entries()) {
    entries.push({
      id: catNameToId.get(categoryName) ?? categoryName,
      month,
      amount,
      categoryId: catNameToId.get(categoryName) ?? '',
      expenseLedgerId: '',
      source: 'bank',
      categoryName,
    });
  }

  // USER_MANUAL entries: one row per transaction, fully editable
  for (const tx of userManualTxs) {
    if (!tx.category) continue;
    entries.push({
      id: tx.id,
      month,
      amount: Number(tx.amount),
      categoryId: catNameToId.get(tx.category) ?? '',
      expenseLedgerId: '',
      source: 'USER_MANUAL',
      categoryName: tx.category,
    });
  }

  return entries;
};

/**
 * Calculate monthly expense totals for a calendar year.
 * Derives totals directly from the Transaction table (source of truth)
 * using DEBIT + CONFIRMED transactions within the fiscal year's date range.
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Array of monthly summaries with total amounts and entry counts
 */
export const getMonthlyExpenseSummaries = async (
  calendarYearId: string,
  userId: string,
): Promise<Array<MonthlyExpenseSummary>> => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });

  if (!calendarYear) {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      totalAmount: 0,
      entryCount: 0,
    }));
  }

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true, amount: true },
  });

  // Aggregate by calendar month
  const monthMap = new Map<number, { totalAmount: number; entryCount: number }>();
  for (const tx of transactions) {
    const month = tx.date.getMonth() + 1;
    const existing = monthMap.get(month) ?? { totalAmount: 0, entryCount: 0 };
    monthMap.set(month, {
      totalAmount: existing.totalAmount + Number(tx.amount),
      entryCount: existing.entryCount + 1,
    });
  }

  // Return all 12 months with zero totals for months without entries
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const agg = monthMap.get(month);
    return {
      month,
      totalAmount: agg?.totalAmount ?? 0,
      entryCount: agg?.entryCount ?? 0,
    };
  });
};

/**
 * Calculate total expenses for a calendar year.
 * Derives totals directly from the Transaction table (source of truth)
 * using DEBIT + CONFIRMED transactions within the fiscal year's date range.
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Total expense amount
 */
export const getTotalExpenses = async (
  calendarYearId: string,
  userId: string,
): Promise<number> => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });

  if (!calendarYear) return 0;

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });

  return Number(result._sum.amount ?? 0);
};

/**
 * Add a new expense entry
 * @param expenseEntryInput - Expense entry data
 * @returns Created expense entry
 */
export const addExpenseEntry = async (
  expenseEntryInput: ExpenseEntryInput,
): Promise<ExpenseEntryModel> => {
  const { month, amount, categoryId, expenseLedgerId } = expenseEntryInput;

  if (!expenseLedgerId) {
    throw new Error('Expense ID is required to add an entry');
  }

  const newEntry = await prisma.monthlyExpenseSummary.create({
    data: {
      month,
      amount,
      categoryId,
      expenseLedgerId,
    },
  });

  return {
    id: newEntry.id,
    month: newEntry.month,
    amount: newEntry.amount.toNumber(),
    categoryId: newEntry.categoryId,
    expenseLedgerId: newEntry.expenseLedgerId,
  };
};

/**
 * Update an existing expense entry
 * @param id - Expense entry ID
 * @param updates - Fields to update
 * @returns Updated expense entry
 */
export const updateExpenseEntry = async (
  id: string,
  updates: Partial<Omit<ExpenseEntryInput, 'expenseLedgerId'>>,
): Promise<ExpenseEntryModel> => {
  const updatedEntry = await prisma.monthlyExpenseSummary.update({
    where: { id },
    data: updates,
  });

  return {
    id: updatedEntry.id,
    month: updatedEntry.month,
    amount: updatedEntry.amount.toNumber(),
    categoryId: updatedEntry.categoryId,
    expenseLedgerId: updatedEntry.expenseLedgerId,
  };
};

/**
 * Delete an expense entry
 * @param id - Expense entry ID
 * @returns Deleted expense entry
 */
export const deleteExpenseEntry = async (
  id: string,
): Promise<ExpenseEntryModel> => {
  const deletedEntry = await prisma.monthlyExpenseSummary.delete({
    where: { id },
  });

  return {
    id: deletedEntry.id,
    month: deletedEntry.month,
    amount: deletedEntry.amount.toNumber(),
    categoryId: deletedEntry.categoryId,
    expenseLedgerId: deletedEntry.expenseLedgerId,
  };
};

/**
 * Get all active expense categories
 * @returns Array of active expense categories
 */
export const getExpenseCategories = async () => {
  return await prisma.expenseCategory.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
};

/**
 * Get category breakdown for a specific month, derived from Transaction table (source of truth).
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param month - Month number (1-12)
 * @returns Array of category breakdowns with amounts and percentages
 */
export const getCategoryBreakdownForMonth = async (
  calendarYearId: string,
  userId: string,
  month: number,
): Promise<Array<CategoryBreakdown>> => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });

  if (!calendarYear) return [];

  const year = month >= calendarYear.fromMonth ? calendarYear.fromYear : calendarYear.toYear;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      date: { gte: startDate, lte: endDate },
    },
    select: { category: true, amount: true },
  });

  // Aggregate by category name
  const categoryAmountMap = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.category) continue;
    const current = categoryAmountMap.get(tx.category) ?? 0;
    categoryAmountMap.set(tx.category, current + Number(tx.amount));
  }

  // Resolve category IDs by name
  const categoryNames = Array.from(categoryAmountMap.keys());
  const expenseCategories = await prisma.expenseCategory.findMany({
    where: { name: { in: categoryNames } },
    select: { id: true, name: true },
  });
  const catNameToId = new Map(expenseCategories.map((c) => [c.name, c.id]));

  const total = Array.from(categoryAmountMap.values()).reduce((sum, amt) => sum + amt, 0);

  return Array.from(categoryAmountMap.entries()).map(([categoryName, amount]) => ({
    categoryId: catNameToId.get(categoryName) ?? '',
    categoryName,
    amount,
    percentage: total > 0 ? (amount / total) * 100 : 0,
  }));
};
