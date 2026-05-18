import { describe, expect, it } from 'vitest';

import { groupByMonth } from '../../app/(authorized)/cashflow/income/IncomeTableClient';
import type { IncomeEntryType } from '../../app/(authorized)/cashflow/income/_types';

function makeEntry(
  overrides: Partial<IncomeEntryType> & { dateEarned: Date; amount: number },
): IncomeEntryType {
  return {
    id: overrides.id ?? `entry-${overrides.amount}-${overrides.dateEarned.getTime()}`,
    dateEarned: overrides.dateEarned,
    amount: overrides.amount,
    incomeSourceId: overrides.incomeSourceId ?? 'source-1',
    incomeSourceName: overrides.incomeSourceName ?? 'Source 1',
    incomeLedgerId: overrides.incomeLedgerId ?? 'ledger-1',
  } as IncomeEntryType;
}

describe('groupByMonth', () => {
  it('returns groups sorted newest-first', () => {
    const groups = groupByMonth([
      makeEntry({ dateEarned: new Date(2025, 3, 10), amount: 100 }),
      makeEntry({ dateEarned: new Date(2025, 4, 10), amount: 200 }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['2025-05', '2025-04']);
  });

  it('calculates correct subtotal per month', () => {
    const groups = groupByMonth([
      makeEntry({ dateEarned: new Date(2025, 4, 1), amount: 100 }),
      makeEntry({ dateEarned: new Date(2025, 4, 15), amount: 250.5 }),
      makeEntry({ dateEarned: new Date(2025, 3, 20), amount: 10 }),
    ]);

    expect(groups[0].subtotal).toBe(350.5);
    expect(groups[1].subtotal).toBe(10);
  });

  it('preserves originalIndex for each entry', () => {
    const entries = [
      makeEntry({ dateEarned: new Date(2025, 4, 1), amount: 100 }),
      makeEntry({ dateEarned: new Date(2025, 4, 2), amount: 200 }),
      makeEntry({ dateEarned: new Date(2025, 4, 3), amount: 300 }),
    ];

    const groups = groupByMonth(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].entries.map((item) => item.originalIndex)).toEqual([0, 1, 2]);
  });

  it('returns empty array for empty input', () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it('groups entries correctly across month boundary', () => {
    const groups = groupByMonth([
      makeEntry({ dateEarned: new Date(2025, 4, 31), amount: 100 }),
      makeEntry({ dateEarned: new Date(2025, 3, 1), amount: 200 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.key)).toEqual(['2025-05', '2025-04']);
  });
});
