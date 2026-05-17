import type { CalendarEnumType } from '@prisma/client';

export type CalendarYearOption = {
  id: string;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  type: CalendarEnumType | null;
};

/**
 * Returns true if `today` falls within the calendar year's date range.
 * Comparison is month-precision: [fromYear/fromMonth, toYear/toMonth] inclusive.
 */
export function isDateInCalendarYear(
  year: CalendarYearOption,
  today: Date,
): boolean {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;

  const afterStart =
    todayYear > year.fromYear ||
    (todayYear === year.fromYear && todayMonth >= year.fromMonth);

  const beforeEnd =
    todayYear < year.toYear ||
    (todayYear === year.toYear && todayMonth <= year.toMonth);

  return afterStart && beforeEnd;
}

/**
 * Filters a list of CalendarYear records to only those matching the given types.
 * Records with `type = null` are always excluded.
 */
export function filterCalendarYearsByType(
  calendarYears: CalendarYearOption[],
  types: CalendarEnumType[],
): CalendarYearOption[] {
  return calendarYears.filter(
    (cy) => cy.type !== null && types.includes(cy.type as CalendarEnumType),
  );
}

/**
 * Selects the best default CalendarYear for a given user preference and date.
 *
 * Priority:
 *   1. Year matching `fiscalYearType` whose date range contains `today`
 *   2. Most recent year matching `fiscalYearType` (by fromYear desc)
 *   3. First entry in `calendarYears` (regardless of type)
 *   4. undefined if the list is empty
 */
export function getDefaultCalendarYear<T extends CalendarYearOption>(
  calendarYears: T[],
  fiscalYearType: CalendarEnumType | null | undefined,
  today: Date = new Date(),
): T | undefined {
  if (calendarYears.length === 0) return undefined;

  const preferredType = fiscalYearType ?? 'FISCAL';

  const preferredYears = calendarYears.filter(
    (cy) => cy.type === preferredType,
  );

  const currentMatch = preferredYears.find((cy) =>
    isDateInCalendarYear(cy, today),
  );
  if (currentMatch) return currentMatch;

  if (preferredYears.length > 0) return preferredYears[0];

  return calendarYears[0];
}
