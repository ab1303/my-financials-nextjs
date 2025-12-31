import {
  addIncomeCalendarYearDetails,
  getIncome,
  getIncomeEntries,
  getTotalIncome,
  getMonthlyIncomeSummary,
  getSourceBreakdown,
} from '../services/income.service';
import { handleCaughtError } from '../utils/prisma';

/**
 * Create or retrieve Income record for a calendar year and user
 * @param calendarYearId - Calendar year ID (typically FISCAL type)
 * @param userId - User ID for ownership
 * @returns Income calendar ID or empty string on error
 */
export const createIncomeYearHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const income = await getIncome(calendarYearId, userId);
    if (!!income.id) return { incomeCalendarId: income.id };

    const incomeCalendarYear = await addIncomeCalendarYearDetails({
      calendarId: calendarYearId,
      userId,
    });

    return { incomeCalendarId: incomeCalendarYear.id };
  } catch (e) {
    handleCaughtError(e);

    return { incomeCalendarId: '' };
  }
};

/**
 * Get Income record details for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Income record or undefined on error
 */
export const incomeHandler = async (calendarYearId: string, userId: string) => {
  try {
    const income = await getIncome(calendarYearId, userId);
    return income;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get all income entries for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Array of income entries or undefined on error
 */
export const incomeEntriesHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const incomeEntries = await getIncomeEntries(calendarYearId, userId);
    return incomeEntries;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get total income for a calendar year
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Total income amount or 0 on error
 */
export const totalIncomeHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const totalIncome = await getTotalIncome(calendarYearId, userId);
    return totalIncome;
  } catch (e) {
    handleCaughtError(e);
    return 0;
  }
};

/**
 * Get monthly income summary for a calendar year
 * Aggregates income entries by month/year with totals
 * @param calendarYearId - Calendar year ID
 * @param userId - User ID for ownership verification
 * @returns Array of monthly summaries or undefined on error
 */
export const monthlyIncomeSummaryHandler = async (
  calendarYearId: string,
  userId: string,
) => {
  try {
    const monthlySummary = await getMonthlyIncomeSummary(
      calendarYearId,
      userId,
    );
    return monthlySummary;
  } catch (e) {
    handleCaughtError(e);
  }
};

/**
 * Get income breakdown by source for a specific month/year
 * @param calendarYearId - Calendar year ID
 * @param month - Month (1-12)
 * @param year - Year (e.g., 2024)
 * @param userId - User ID for ownership verification
 * @returns Array of source breakdowns with percentages or undefined on error
 */
export const sourceBreakdownHandler = async (
  calendarYearId: string,
  month: number,
  year: number,
  userId: string,
) => {
  try {
    const sourceBreakdown = await getSourceBreakdown(
      calendarYearId,
      month,
      year,
      userId,
    );
    return sourceBreakdown;
  } catch (e) {
    handleCaughtError(e);
  }
};
