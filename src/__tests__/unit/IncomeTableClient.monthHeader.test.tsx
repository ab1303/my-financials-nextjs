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

describe('IncomeTableClient — Month Header (Accordion)', () => {
  const singleEntry: IncomeEntryType[] = [
    {
      id: '1',
      dateEarned: new Date('2024-01-15'),
      amount: 1000,
      incomeSourceId: 'source-1',
      incomeSourceName: 'Employment',
      incomeLedgerId: 'ledger-1',
    },
  ];

  it('renders accordion button header with month label', () => {
    render(
      <IncomeEntryStateProvider data={singleEntry}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    // Month label rendered inside accordion toggle button
    const monthLabel = screen.getByText('January 2024');
    expect(monthLabel).toBeInTheDocument();

    // The header is an accordion button, not a <tr>
    const button = monthLabel.closest('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded');
  });

  it('accordion header has flex layout with justify-between', () => {
    render(
      <IncomeEntryStateProvider data={singleEntry}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    const monthLabel = screen.getByText('January 2024');
    const button = monthLabel.closest('button');
    // The accordion toggle button has justify-between layout
    expect(button).toHaveClass('justify-between');
  });

  it('accordion header shows subtotal amount', () => {
    const twoEntries: IncomeEntryType[] = [
      { id: '1', dateEarned: new Date('2024-01-15'), amount: 1000, incomeSourceId: 'source-1', incomeSourceName: 'Employment', incomeLedgerId: 'ledger-1' },
      { id: '2', dateEarned: new Date('2024-01-20'), amount: 500, incomeSourceId: 'source-1', incomeSourceName: 'Employment', incomeLedgerId: 'ledger-1' },
    ];

    render(
      <IncomeEntryStateProvider data={twoEntries}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    expect(screen.getByText('January 2024')).toBeInTheDocument();
    // Subtotal is displayed in the accordion header ($1,500.00)
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  it('renders entry count badge in accordion header', () => {
    render(
      <IncomeEntryStateProvider data={singleEntry}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>
    );

    // Entry count badge showing number of entries in the month
    const badge = screen.getByText('1');
    expect(badge).toBeInTheDocument();
  });
});


