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
  return await prisma.expense.create({
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
  const expense = await prisma.expense.findUnique({
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
  const where: Partial<Prisma.ExpenseEntryWhereInput> = {
    expense: {
      calendarId: calendarYearId,
      userId,
    },
  };

  const expenseEntries = await prismaClient.expenseEntry.findMany({
    where,
    include: {
      expense: true,
      category: true,
    },
    orderBy: [{ month: 'asc' }, { category: { name: 'asc' } }],
  });

  return expenseEntries.map<ExpenseEntryWithCategory>((entry) => ({
    id: entry.id,
    month: entry.month,
    amount: entry.amount.toNumber(),
    categoryId: entry.categoryId,
    expenseId: entry.expenseId,
    categoryName: entry.category.name,
  }));
};

/**
 * Get expense entries for a specific month
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param month - Month number (1-12)
 * @returns Array of expense entries for the specified month
 */
export const getExpenseEntriesForMonth = async (
  calendarYearId: string,
  userId: string,
  month: number,
): Promise<Array<ExpenseEntryWithCategory>> => {
  const where: Partial<Prisma.ExpenseEntryWhereInput> = {
    expense: {
      calendarId: calendarYearId,
      userId,
    },
    month,
  };

  const expenseEntries = await prisma.expenseEntry.findMany({
    where,
    include: {
      expense: true,
      category: true,
    },
    orderBy: {
      category: { name: 'asc' },
    },
  });

  return expenseEntries.map<ExpenseEntryWithCategory>((entry) => ({
    id: entry.id,
    month: entry.month,
    amount: entry.amount.toNumber(),
    categoryId: entry.categoryId,
    expenseId: entry.expenseId,
    categoryName: entry.category.name,
  }));
};

/**
 * Calculate monthly expense totals for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Array of monthly summaries with total amounts and entry counts
 */
export const getMonthlyExpenseSummaries = async (
  calendarYearId: string,
  userId: string,
): Promise<Array<MonthlyExpenseSummary>> => {
  // Get the expense record first
  const expense = await getExpense(calendarYearId, userId);

  if (!expense.id) {
    // No expense record exists, return empty summaries for all 12 months
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      totalAmount: 0,
      entryCount: 0,
    }));
  }

  // Aggregate by month
  const monthlyAggregates = await prisma.expenseEntry.groupBy({
    by: ['month'],
    where: {
      expenseId: expense.id,
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  // Create a map for quick lookup
  const aggregateMap = new Map(
    monthlyAggregates.map((agg) => [
      agg.month,
      {
        totalAmount: agg._sum.amount?.toNumber() || 0,
        entryCount: agg._count.id,
      },
    ]),
  );

  // Return all 12 months with zero totals for months without entries
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const aggregate = aggregateMap.get(month);
    return {
      month,
      totalAmount: aggregate?.totalAmount || 0,
      entryCount: aggregate?.entryCount || 0,
    };
  });
};

/**
 * Calculate total expenses for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Total expense amount
 */
export const getTotalExpenses = async (
  calendarYearId: string,
  userId: string,
): Promise<number> => {
  const expense = await getExpense(calendarYearId, userId);

  if (!expense.id) {
    return 0;
  }

  const result = await prisma.expenseEntry.aggregate({
    where: {
      expenseId: expense.id,
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount?.toNumber() || 0;
};

/**
 * Add a new expense entry
 * @param expenseEntryInput - Expense entry data
 * @returns Created expense entry
 */
export const addExpenseEntry = async (
  expenseEntryInput: ExpenseEntryInput,
): Promise<ExpenseEntryModel> => {
  const { month, amount, categoryId, expenseId } = expenseEntryInput;

  if (!expenseId) {
    throw new Error('Expense ID is required to add an entry');
  }

  const newEntry = await prisma.expenseEntry.create({
    data: {
      month,
      amount,
      categoryId,
      expenseId,
    },
  });

  return {
    id: newEntry.id,
    month: newEntry.month,
    amount: newEntry.amount.toNumber(),
    categoryId: newEntry.categoryId,
    expenseId: newEntry.expenseId,
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
  updates: Partial<Omit<ExpenseEntryInput, 'expenseId'>>,
): Promise<ExpenseEntryModel> => {
  const updatedEntry = await prisma.expenseEntry.update({
    where: { id },
    data: updates,
  });

  return {
    id: updatedEntry.id,
    month: updatedEntry.month,
    amount: updatedEntry.amount.toNumber(),
    categoryId: updatedEntry.categoryId,
    expenseId: updatedEntry.expenseId,
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
  const deletedEntry = await prisma.expenseEntry.delete({
    where: { id },
  });

  return {
    id: deletedEntry.id,
    month: deletedEntry.month,
    amount: deletedEntry.amount.toNumber(),
    categoryId: deletedEntry.categoryId,
    expenseId: deletedEntry.expenseId,
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
 * Get category breakdown for a specific month
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
  const expense = await getExpense(calendarYearId, userId);

  if (!expense.id) {
    return [];
  }

  const categoryAggregates = await prisma.expenseEntry.groupBy({
    by: ['categoryId'],
    where: {
      expenseId: expense.id,
      month,
    },
    _sum: {
      amount: true,
    },
  });

  // Get category names
  const categoryIds = categoryAggregates.map((agg) => agg.categoryId);
  const categories = await prisma.expenseCategory.findMany({
    where: {
      id: { in: categoryIds },
    },
  });

  const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]));

  // Calculate total for percentage
  const total = categoryAggregates.reduce(
    (sum, agg) => sum + (agg._sum.amount?.toNumber() || 0),
    0,
  );

  return categoryAggregates.map((agg) => ({
    categoryId: agg.categoryId,
    categoryName: categoryMap.get(agg.categoryId) || 'Unknown',
    amount: agg._sum.amount?.toNumber() || 0,
    percentage:
      total > 0 ? ((agg._sum.amount?.toNumber() || 0) / total) * 100 : 0,
  }));
};
