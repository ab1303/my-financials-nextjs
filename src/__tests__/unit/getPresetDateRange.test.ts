import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuFYRange, getPresetDateRange, getTwoYearsAgoDate } from '@/components/transactions/TransactionFilters';

describe('date preset helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 7, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current month range', () => {
    expect(getPresetDateRange('this-month')).toEqual({ from: '2024-08-01', to: '2024-08-15' });
  });

  it('returns last month range', () => {
    expect(getPresetDateRange('last-month')).toEqual({ from: '2024-07-01', to: '2024-07-31' });
  });

  it('returns current quarter range', () => {
    expect(getPresetDateRange('this-quarter')).toEqual({ from: '2024-07-01', to: '2024-08-15' });
  });

  it('returns Australian financial year range', () => {
    expect(getPresetDateRange('this-fy')).toEqual({ from: '2024-07-01', to: '2024-08-15' });
    expect(getAuFYRange('this-fy')).toEqual({ from: '2024-07-01', to: '2024-08-15' });
  });

  it('returns last financial year range', () => {
    expect(getPresetDateRange('last-fy')).toEqual({ from: '2023-07-01', to: '2024-06-30' });
  });

  it('returns null for custom and calculates two-year lookback', () => {
    expect(getPresetDateRange('custom')).toBeNull();
    expect(getTwoYearsAgoDate()).toBe('2022-08-15');
  });
});
