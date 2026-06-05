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

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock(
  '@/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget',
  () => ({
    default: () => <div>SourceBreakdownWidget</div>,
  }),
);

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
      source: 'USER_MANUAL',
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
      source: 'USER_MANUAL',
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
      </IncomeEntryStateProvider>,
    );

    // Month label rendered inside accordion toggle button
    const monthLabel = screen.getByText('January 2024');
    expect(monthLabel).toBeInTheDocument();

    // The header is an accordion button, not a <tr>
    const button = monthLabel.closest('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded');
  });

  it('accordion header has flex layout with justify-between on the outer container', () => {
    render(
      <IncomeEntryStateProvider data={singleEntry}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>,
    );

    const monthLabel = screen.getByText('January 2024');
    // After refactor, the outer container div has justify-between, not the toggle button
    const toggleButton = monthLabel.closest('button');
    expect(toggleButton).toBeInTheDocument();
    // The outer header div wraps both the toggle button and the ledger link
    const headerDiv = toggleButton?.parentElement;
    expect(headerDiv).toHaveClass('justify-between');
  });

  it('accordion header shows subtotal amount', () => {
    const twoEntries: IncomeEntryType[] = [
      {
        id: '1',
        dateEarned: new Date('2024-01-15'),
        amount: 1000,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: 'ledger-1',
        source: 'USER_MANUAL',
      },
      {
        id: '2',
        dateEarned: new Date('2024-01-20'),
        amount: 500,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Employment',
        incomeLedgerId: 'ledger-1',
        source: 'USER_MANUAL',
      },
    ];

    render(
      <IncomeEntryStateProvider data={twoEntries}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>,
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
      </IncomeEntryStateProvider>,
    );

    // Entry count badge showing number of entries in the month
    const badge = screen.getByText('1');
    expect(badge).toBeInTheDocument();
  });

  it('renders a link to the transaction ledger with correct month and year', () => {
    render(
      <IncomeEntryStateProvider data={singleEntry}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>,
    );

    const link = screen.getByRole('link', {
      name: /View January 2024 transactions in ledger/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      '/cashflow/transactions?month=1&year=2024&tab=income',
    );
  });

  it('ledger link href encodes month and year from monthKey correctly', () => {
    const julyEntry: IncomeEntryType[] = [
      {
        id: '2',
        dateEarned: new Date('2024-07-10'),
        amount: 2500,
        incomeSourceId: 'source-1',
        incomeSourceName: 'Salary',
        incomeLedgerId: 'ledger-1',
        source: 'USER_MANUAL',
      },
    ];

    render(
      <IncomeEntryStateProvider data={julyEntry}>
        <IncomeTableClient
          editRow={mockServerActions.editRow}
          addRow={mockServerActions.addRow}
          deleteRow={mockServerActions.deleteRow}
          calendarYearId='year-2024'
        />
      </IncomeEntryStateProvider>,
    );

    const link = screen.getByRole('link', {
      name: /View July 2024 transactions in ledger/i,
    });
    expect(link).toHaveAttribute(
      'href',
      '/cashflow/transactions?month=7&year=2024&tab=income',
    );
  });
});
