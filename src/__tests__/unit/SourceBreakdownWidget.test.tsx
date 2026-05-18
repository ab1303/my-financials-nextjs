import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SourceBreakdownWidget, { computeBreakdown } from '@/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget';
import type { IncomeEntryType } from '@/app/(authorized)/cashflow/income/_types';

const entries: IncomeEntryType[] = [
  {
    id: '1',
    dateEarned: new Date('2024-01-01'),
    amount: 300,
    incomeSourceId: 'employment-1',
    incomeSourceName: 'Employment',
    incomeLedgerId: 'ledger-1',
  },
  {
    id: '2',
    dateEarned: new Date('2024-01-02'),
    amount: 100,
    incomeSourceId: 'stocks-1',
    incomeSourceName: 'Stocks',
    incomeLedgerId: 'ledger-1',
  },
];

describe('SourceBreakdownWidget', () => {
  it('renders nothing when entries is empty', () => {
    const { container } = render(<SourceBreakdownWidget entries={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows correct percentage for a two-source dataset', () => {
    render(<SourceBreakdownWidget entries={entries} />);

    expect(screen.getByTitle('Employment: 75.0%')).toBeInTheDocument();
    expect(screen.getByTitle('Stocks: 25.0%')).toBeInTheDocument();
  });

  it('renders a SourceBadge for each source', () => {
    render(<SourceBreakdownWidget entries={entries} />);

    expect(screen.getByText('Employment')).toBeInTheDocument();
    expect(screen.getByText('Stocks')).toBeInTheDocument();
  });

  it('handles a single source as 100%', () => {
    const breakdown = computeBreakdown([entries[0]]);

    expect(breakdown).toEqual([
      expect.objectContaining({
        sourceName: 'Employment',
        total: 300,
        percentage: 100,
      }),
    ]);
  });

  it('sorts by descending total', () => {
    const breakdown = computeBreakdown([
      entries[1],
      entries[0],
      {
        id: '3',
        dateEarned: new Date('2024-01-03'),
        amount: 50,
        incomeSourceId: 'interest-1',
        incomeSourceName: 'Interest',
        incomeLedgerId: 'ledger-1',
      },
    ]);

    expect(breakdown.map((item) => item.sourceName)).toEqual(['Employment', 'Stocks', 'Interest']);
  });
});
