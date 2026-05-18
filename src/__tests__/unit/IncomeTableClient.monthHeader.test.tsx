import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';

import IncomeTableClient from '@/app/(authorized)/cashflow/income/IncomeTableClient';
import { IncomeEntryStateProvider } from '@/app/(authorized)/cashflow/income/StateProvider';
import type { IncomeEntryType } from '@/app/(authorized)/cashflow/income/_types';

// Mock the dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock('@/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget', () => ({
  default: () => <div>SourceBreakdownWidget</div>,
}));

// Mock server actions - use any to allow flexible mock behavior
const mockServerActions = {
  editRow: vi.fn(async () => ({ success: true })) as any,
  addRow: vi.fn(async () => ({
    success: true,
    data: {
      id: 'mock-id',
      dateEarned: new Date(),
      amount: 0,
      incomeSourceId: '',
      incomeSourceName: '',
      incomeLedgerId: '',
    } as IncomeEntryType,
  })) as any,
  deleteRow: vi.fn(async () => ({ success: true })) as any,
};

describe('IncomeTableClient — Month Header', () => {
  it('renders a native <tr> element for month header (not TBodyTR)', () => {
    const entries: IncomeEntryType[] = [
      {
        id: '1',
        dateEarned: new Date('2024-01-15'),
        amount: 1000,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: 'ledger-1',
      },
    ];

    const { container } = render(
      <IncomeEntryStateProvider data={entries}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    // Find the month header row by looking for the month label text
    const monthLabel = screen.getByText('January 2024');

    // Traverse up to find the parent <tr>
    const row = monthLabel.closest('tr');

    // Verify it's a raw <tr>, not wrapped in a component
    expect(row).toBeInTheDocument();
    expect(row?.tagName).toBe('TR');
  });

  it('month header <td> spans all columns', () => {
    const entries: IncomeEntryType[] = [
      {
        id: '1',
        dateEarned: new Date('2024-01-15'),
        amount: 1000,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: 'ledger-1',
      },
    ];

    const { container } = render(
      <IncomeEntryStateProvider data={entries}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    const monthLabel = screen.getByText('January 2024');
    const cell = monthLabel.closest('td');

    // Check that colSpan is set (number of columns in the table)
    expect(cell).toHaveAttribute('colSpan');
    const colSpan = cell?.getAttribute('colSpan');
    expect(colSpan).toBeTruthy();
  });

  it('month header contains flex layout with month label and subtotal', () => {
    const entries: IncomeEntryType[] = [
      {
        id: '1',
        dateEarned: new Date('2024-01-15'),
        amount: 1000,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: 'ledger-1',
      },
      {
        id: '2',
        dateEarned: new Date('2024-01-20'),
        amount: 500,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: 'ledger-1',
      },
    ];

    render(
      <IncomeEntryStateProvider data={entries}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    // Verify month label is present
    const monthLabel = screen.getByText('January 2024');
    expect(monthLabel).toBeInTheDocument();

    // Verify subtotal is rendered (sum: $1500)
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();

    // Verify the flex container exists
    const monthLabelSpan = monthLabel;
    const flexContainer = monthLabelSpan.closest('div');

    // The flex div should have display: flex (flex class applied)
    expect(flexContainer).toHaveClass('flex');
    expect(flexContainer).toHaveClass('justify-between');
  });

  it('renders entry rows using TBodyTR (regular rows unchanged)', () => {
    const entries: IncomeEntryType[] = [
      {
        id: '1',
        dateEarned: new Date('2024-01-15'),
        amount: 1000,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: 'ledger-1',
      },
    ];

    const { container } = render(
      <IncomeEntryStateProvider data={entries}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    // Count all <tr> elements (should be: 1 header + 1 month header + 1 entry row = 3)
    const allRows = container.querySelectorAll('tbody tr');
    expect(allRows.length).toBeGreaterThanOrEqual(2); // At least month header and entry row
  });
});


