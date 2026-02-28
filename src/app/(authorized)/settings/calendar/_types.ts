import { CalendarEnumType } from '@prisma/client';

export type ServerActionType = {
  success: boolean;
  error?: string;
  isReferentialIntegrityError?: boolean;
};

export type CalendarYearType = {
  id: string;
  type: CalendarEnumType | null;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
};

const CALENDAR_KEYS = Object.entries(CalendarEnumType).map(
  ([k]) => k as CalendarEnumType,
);

export { CALENDAR_KEYS };

/**
 * Determines if a calendar year entry is "current" —
 * i.e., today's date falls within its from/to date range.
 */
export function isCurrentCalendarYear(entry: CalendarYearType): boolean {
  const today = new Date();
  // First day of the fromMonth
  const fromDate = new Date(entry.fromYear, entry.fromMonth - 1, 1);
  // Last day of the toMonth
  const toDate = new Date(entry.toYear, entry.toMonth, 0, 23, 59, 59, 999);
  return fromDate <= today && today <= toDate;
}

export type YearRangeGroup = {
  label: string;
  fromYear: number;
  toYear: number;
  entries: CalendarYearType[];
};

/**
 * Groups calendar year entries by their (fromYear, toYear) pair
 * and returns the groups sorted descending (newest first).
 */
export function groupByYearRange(
  entries: CalendarYearType[],
): YearRangeGroup[] {
  const map = new Map<string, YearRangeGroup>();

  for (const entry of entries) {
    const key = `${entry.fromYear}-${entry.toYear}`;
    const existing = map.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      map.set(key, {
        label: `${entry.fromYear} – ${entry.toYear}`,
        fromYear: entry.fromYear,
        toYear: entry.toYear,
        entries: [entry],
      });
    }
  }

  // Sort descending by toYear, then fromYear
  return Array.from(map.values()).sort((a, b) => {
    if (b.toYear !== a.toYear) return b.toYear - a.toYear;
    return b.fromYear - a.fromYear;
  });
}
