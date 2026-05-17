import { describe, it, expect } from 'vitest';
import {
  getDefaultCalendarYear,
  filterCalendarYearsByType,
  isDateInCalendarYear,
  type CalendarYearOption,
} from '../calendar-year-defaults';

const makeYear = (
  id: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  type: 'FISCAL' | 'ANNUAL' | 'ZAKAT',
): CalendarYearOption => ({
  id,
  description: `${fromYear}-${toYear}`,
  fromYear,
  fromMonth,
  toYear,
  toMonth,
  type,
});

const FISCAL_2425 = makeYear('fy2425', 2024, 7, 2025, 6, 'FISCAL');
const FISCAL_2324 = makeYear('fy2324', 2023, 7, 2024, 6, 'FISCAL');
const ANNUAL_2024 = makeYear('ay2024', 2024, 1, 2024, 12, 'ANNUAL');
const ANNUAL_2023 = makeYear('ay2023', 2023, 1, 2023, 12, 'ANNUAL');
const ZAKAT_2024 = makeYear('zk2024', 2024, 1, 2024, 12, 'ZAKAT');
const NULL_TYPE: CalendarYearOption = {
  ...ANNUAL_2024,
  id: 'null1',
  type: null,
};

describe('isDateInCalendarYear', () => {
  it('returns true when today is the first month of the year', () => {
    expect(isDateInCalendarYear(FISCAL_2425, new Date(2024, 6, 1))).toBe(true);
  });

  it('returns true when today is the last month of the year', () => {
    expect(isDateInCalendarYear(FISCAL_2425, new Date(2025, 5, 30))).toBe(true);
  });

  it('returns false when today is before the start', () => {
    expect(isDateInCalendarYear(FISCAL_2425, new Date(2024, 5, 30))).toBe(
      false,
    );
  });

  it('returns false when today is after the end', () => {
    expect(isDateInCalendarYear(FISCAL_2425, new Date(2025, 6, 1))).toBe(false);
  });
});

describe('filterCalendarYearsByType', () => {
  it('removes ZAKAT records from the list', () => {
    const result = filterCalendarYearsByType(
      [FISCAL_2425, ANNUAL_2024, ZAKAT_2024],
      ['FISCAL', 'ANNUAL'],
    );
    expect(result.map((r) => r.id)).not.toContain('zk2024');
  });

  it('removes records with type = null', () => {
    const result = filterCalendarYearsByType(
      [FISCAL_2425, NULL_TYPE],
      ['FISCAL', 'ANNUAL'],
    );
    expect(result.map((r) => r.id)).not.toContain('null1');
  });

  it('returns only FISCAL when ["FISCAL"] passed', () => {
    const result = filterCalendarYearsByType(
      [FISCAL_2425, ANNUAL_2024, ZAKAT_2024],
      ['FISCAL'],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('fy2425');
  });
});

describe('getDefaultCalendarYear', () => {
  it('returns the current FISCAL year for a FISCAL user', () => {
    const result = getDefaultCalendarYear(
      [FISCAL_2425, ANNUAL_2024],
      'FISCAL',
      new Date(2024, 9, 1),
    );
    expect(result?.id).toBe('fy2425');
  });

  it('returns the current ANNUAL year for an ANNUAL user', () => {
    const result = getDefaultCalendarYear(
      [FISCAL_2425, ANNUAL_2024],
      'ANNUAL',
      new Date(2024, 9, 1),
    );
    expect(result?.id).toBe('ay2024');
  });

  it('falls back to most recent FISCAL when no date match', () => {
    const result = getDefaultCalendarYear(
      [FISCAL_2324, FISCAL_2425],
      'FISCAL',
      new Date(2030, 0, 1),
    );
    expect(result?.id).toBe('fy2324');
  });

  it('falls back to list[0] when no preferred-type years exist', () => {
    const result = getDefaultCalendarYear(
      [ANNUAL_2024],
      'FISCAL',
      new Date(2024, 9, 1),
    );
    expect(result?.id).toBe('ay2024');
  });

  it('returns undefined for empty list', () => {
    expect(getDefaultCalendarYear([], 'FISCAL')).toBeUndefined();
  });

  it('uses FISCAL as default when fiscalYearType is null', () => {
    const result = getDefaultCalendarYear(
      [FISCAL_2425, ANNUAL_2024],
      null,
      new Date(2024, 9, 1),
    );
    expect(result?.id).toBe('fy2425');
  });

  it('uses FISCAL as default when fiscalYearType is undefined', () => {
    const result = getDefaultCalendarYear(
      [FISCAL_2425, ANNUAL_2024],
      undefined,
      new Date(2024, 9, 1),
    );
    expect(result?.id).toBe('fy2425');
  });
});
