import type { MonthlyTrendPoint, TopExpenseCategory } from '../models/dashboard';
import { prisma } from '../utils/prisma';
import { TRANSFER_CATEGORY } from './transactions/constants';

// Month names for label formatting
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Get monthly income vs expenses trend for a given number of months
 * @param userId - User ID for ownership verification
 * @param months - Number of months to retrieve (default: 6)
 * @returns Array of monthly trend points sorted by year/month ascending
 */
export const getMonthlyIncomeExpenseTrend = async (
  userId: string,
  months: number = 6,
): Promise<MonthlyTrendPoint[]> => {
  // Calculate date range
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  // Start from (current month - months + 1) and go to end of current month
  const startMonthOffset = months - 1;
  const fromDate = new Date(currentYear, currentMonth - startMonthOffset - 1, 1, 0, 0, 0, 0);
  const toDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  // Pre-populate map for all months to ensure zero-data months appear
  const trendMap = new Map<string, { income: number; expenses: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(currentYear, currentMonth - i - 1, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    trendMap.set(key, { income: 0, expenses: 0 });
  }

  // Query transactions
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      date: {
        gte: fromDate,
        lte: toDate,
      },
      category: { not: TRANSFER_CATEGORY },
      type: { in: ['CREDIT', 'DEBIT'] },
    },
    select: {
      date: true,
      amount: true,
      type: true,
    },
  });

  // Group transactions by month and aggregate
  for (const tx of transactions) {
    const year = tx.date.getFullYear();
    const month = tx.date.getMonth() + 1; // 1-12
    const key = `${year}-${String(month).padStart(2, '0')}`;

    const current = trendMap.get(key);
    if (!current) continue;

    const amount = tx.amount.toNumber();

    if (tx.type === 'CREDIT') {
      current.income += amount;
    } else if (tx.type === 'DEBIT') {
      current.expenses += amount;
    }
  }

  // Convert map to sorted array
  const result: MonthlyTrendPoint[] = [];
  const sortedKeys = Array.from(trendMap.keys()).sort();

  for (const key of sortedKeys) {
    const parts = key.split('-');
    const yearStr = parts[0];
    const monthStr = parts[1];
    
    if (!yearStr || !monthStr) continue;
    
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const data = trendMap.get(key)!;
    const label = `${MONTH_NAMES[month - 1]} ${String(year).slice(2)}`;

    result.push({
      month,
      year,
      label,
      income: data.income,
      expenses: data.expenses,
    });
  }

  return result;
};

/**
 * Get top expense categories for a date range
 * @param userId - User ID for ownership verification
 * @param fromDate - Start date (inclusive)
 * @param toDate - End date (inclusive)
 * @param limit - Maximum number of categories to return (default: 5)
 * @returns Array of top expense categories sorted by amount descending
 */
export const getTopExpenseCategories = async (
  userId: string,
  fromDate: Date,
  toDate: Date,
  limit: number = 5,
): Promise<TopExpenseCategory[]> => {
  // Query all DEBIT transactions in the date range
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { not: TRANSFER_CATEGORY },
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: {
      category: true,
      amount: true,
    },
  });

  // Group by category and sum amounts
  const categoryMap = new Map<string, number>();
  let totalAmount = 0;

  for (const tx of transactions) {
    const amount = tx.amount.toNumber();
    totalAmount += amount;

    const current = categoryMap.get(tx.category) ?? 0;
    categoryMap.set(tx.category, current + amount);
  }

  const result: TopExpenseCategory[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);

  return result;
};

/**
 * Get monthly income vs expenses trend for an explicit date range (e.g. a full fiscal year).
 * All months between fromDate and toDate are pre-populated so months with no data still appear.
 */
export const getMonthlyTrendForDateRange = async (
  userId: string,
  fromDate: Date,
  toDate: Date,
): Promise<MonthlyTrendPoint[]> => {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      date: { gte: fromDate, lte: toDate },
      category: { not: TRANSFER_CATEGORY },
      type: { in: ['CREDIT', 'DEBIT'] },
    },
    select: { date: true, amount: true, type: true },
  });

  // Pre-populate all months in the range (so months with $0 still appear)
  const trendMap = new Map<string, { income: number; expenses: number }>();
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const rangeEnd = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  while (cursor <= rangeEnd) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    trendMap.set(key, { income: 0, expenses: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const tx of transactions) {
    const year = tx.date.getFullYear();
    const month = tx.date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const bucket = trendMap.get(key);
    if (!bucket) continue;
    const amount = tx.amount.toNumber();
    if (tx.type === 'CREDIT') bucket.income += amount;
    else bucket.expenses += amount;
  }

  const result: MonthlyTrendPoint[] = [];
  for (const key of Array.from(trendMap.keys()).sort()) {
    const parts = key.split('-');
    const year = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    const data = trendMap.get(key)!;
    result.push({
      month, year,
      label: `${MONTH_NAMES[month - 1]} ${String(year).slice(2)}`,
      income: data.income,
      expenses: data.expenses,
    });
  }

  return result;
};
