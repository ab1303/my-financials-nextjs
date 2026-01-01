import {
  addExpenseCalendarYearDetails,
  getExpense,
  getExpenseEntries,
  getExpenseEntriesForMonth,
  getTotalExpenses,
  getMonthlyExpenseSummaries,
  getCategoryBreakdownForMonth,
  getExpenseCategories,
} from '../services/expense.service';
import { handleCaughtError } from '../utils/prisma';

/**
 * Create or retrieve Expense record for a calendar year and user
 * @param calendarYearId - Calendar year ID (typically FISCAL type)
 * @param userId - User ID for ownership
 * @returns Expense calendar ID or empty string on error
 */
export const createExpenseYearHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const expense = await getExpense(calendarYearId, userId);
    if (!!expense.id) return { expenseCalendarId: expense.id };

    const expenseCalendarYear = await addExpenseCalendarYearDetails({
      calendarId: calendarYearId,
      userId,
    });

    return { expenseCalendarId: expenseCalendarYear.id };
  } catch (e) {
    handleCaughtError(e);

    return { expenseCalendarId: '' };
  }
};

/**
 * Get Expense record details for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Expense record or undefined on error
 */
export const expenseHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const expense = await getExpense(calendarYearId, userId);
    return expense;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get all expense entries for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Array of expense entries or undefined on error
 */
export const expenseEntriesHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const expenseEntries = await getExpenseEntries(calendarYearId, userId);
    return expenseEntries;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get expense entries for a specific month
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param month - Month number (1-12)
 * @returns Array of expense entries for the month or undefined on error
 */
export const expenseEntriesForMonthHandler = async (
  calendarYearId: string,
  userId: string,
  month: number,
) => {
  try {
    const expenseEntries = await getExpenseEntriesForMonth(
      calendarYearId,
      userId,
      month,
    );
    return expenseEntries;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get total expenses for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Total expense amount or 0 on error
 */
export const totalExpensesHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const total = await getTotalExpenses(calendarYearId, userId);
    return total;
  } catch (e) {
    handleCaughtError(e);
    return 0;
  }
};

/**
 * Get monthly expense summaries for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Array of 12 monthly summaries or undefined on error
 */
export const monthlyExpenseSummariesHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const summaries = await getMonthlyExpenseSummaries(calendarYearId, userId);
    return summaries;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get category breakdown for a specific month
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param month - Month number (1-12)
 * @returns Array of category breakdowns or undefined on error
 */
export const categoryBreakdownHandler = async (
  calendarYearId: string,
  userId: string,
  month: number,
) => {
  try {
    const breakdown = await getCategoryBreakdownForMonth(
      calendarYearId,
      userId,
      month,
    );
    return breakdown;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get all active expense categories
 * @returns Array of expense categories or undefined on error
 */
export const expenseCategoriesHandler = async () => {
  try {
    const categories = await getExpenseCategories();
    return categories;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get complete expense data for the main page
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Complete expense data including monthly summaries and total
 */
export const getExpenseDataHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    // Ensure expense record exists
    const { expenseCalendarId } = await createExpenseYearHandler(
      calendarYearId,
      userId,
    );

    if (!expenseCalendarId) {
      throw new Error('Failed to create or retrieve expense record');
    }

    // Get monthly summaries and total in parallel
    const [monthlySummaries, totalAmount] = await Promise.all([
      getMonthlyExpenseSummaries(calendarYearId, userId),
      getTotalExpenses(calendarYearId, userId),
    ]);

    return {
      calendarId: calendarYearId,
      userId,
      monthlySummaries,
      totalAmount,
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get expense data for category breakdown modal
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @param month - Month number (1-12)
 * @returns Expense entries for the specified month
 */
export const getMonthBreakdownHandler = async (
  calendarYearId: string,
  userId: string,
  month: number,
) => {
  try {
    // Ensure expense record exists
    await createExpenseYearHandler(calendarYearId, userId);

    const entries = await getExpenseEntriesForMonth(
      calendarYearId,
      userId,
      month,
    );

    return entries;
  } catch (e) {
    handleCaughtError(e);
  }
};
