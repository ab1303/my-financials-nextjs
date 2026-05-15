import { describe, it, expect } from 'vitest';
import { makeDedupKey, isDuplicate, getDateRangeFromMonthKeys } from '@/server/services/transactions/dedup.service';

describe('makeDedupKey', () => {
  it('normalises ISO datetime to date-only', () => {
    const key = makeDedupKey({
      date: '2025-01-15T10:30:00.000Z',
      description: 'Woolworths',
      amount: 42.5,
      type: 'DEBIT',
    });
    expect(key).toBe('2025-01-15|woolworths|42.50|DEBIT');
  });

  it('trims and lowercases description', () => {
    const key = makeDedupKey({
      date: '2025-01-15',
      description: '  Woolworths Town Hall  ',
      amount: 42.5,
      type: 'DEBIT',
    });
    expect(key).toBe('2025-01-15|woolworths town hall|42.50|DEBIT');
  });

  it('formats amount to 2 decimal places', () => {
    const key1 = makeDedupKey({ date: '2025-01-15', description: 'Test', amount: 12.1, type: 'DEBIT' });
    const key2 = makeDedupKey({ date: '2025-01-15', description: 'Test', amount: 12.10, type: 'DEBIT' });
    expect(key1).toBe(key2);
    expect(key1).toContain('12.10');
  });

  it('produces different keys for DEBIT vs CREDIT', () => {
    const base = { date: '2025-01-15', description: 'Test', amount: 50 };
    const debitKey = makeDedupKey({ ...base, type: 'DEBIT' });
    const creditKey = makeDedupKey({ ...base, type: 'CREDIT' });
    expect(debitKey).not.toBe(creditKey);
  });

  it('handles whole number amounts', () => {
    const key = makeDedupKey({ date: '2025-01-15', description: 'Test', amount: 5, type: 'DEBIT' });
    expect(key).toContain('5.00');
  });
});

describe('isDuplicate', () => {
  it('returns true when key exists in set', () => {
    const set = new Set(['2025-01-15|test|50.00|DEBIT']);
    expect(isDuplicate('2025-01-15|test|50.00|DEBIT', set)).toBe(true);
  });

  it('returns false when key does not exist', () => {
    const set = new Set(['2025-01-15|test|50.00|DEBIT']);
    expect(isDuplicate('2025-01-16|test|50.00|DEBIT', set)).toBe(false);
  });
});

describe('getDateRangeFromMonthKeys', () => {
  it('computes range for multiple months', () => {
    const { startDate, endDate } = getDateRangeFromMonthKeys(['2025-01', '2025-03']);
    expect(startDate).toEqual(new Date(2025, 0, 1));
    expect(endDate.getFullYear()).toBe(2025);
    expect(endDate.getMonth()).toBe(2);
    expect(endDate.getDate()).toBe(31);
  });

  it('handles single month', () => {
    const { startDate, endDate } = getDateRangeFromMonthKeys(['2025-06']);
    expect(startDate).toEqual(new Date(2025, 5, 1));
    expect(endDate.getDate()).toBe(30);
  });

  it('sorts unsorted month keys correctly', () => {
    const { startDate, endDate } = getDateRangeFromMonthKeys(['2025-03', '2025-01', '2025-02']);
    expect(startDate).toEqual(new Date(2025, 0, 1));
    expect(endDate.getMonth()).toBe(2);
  });
});
