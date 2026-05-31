import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssetBalanceCards } from '@/app/(authorized)/home/_components/AssetBalanceCards';
import { CashflowPulseCard } from '@/app/(authorized)/home/_components/CashflowPulseCard';
import { NetWorthWidget } from '@/app/(authorized)/home/_components/NetWorthWidget';
import { RecentTransactionsWidget } from '@/app/(authorized)/home/_components/RecentTransactionsWidget';
import type { DashboardSummaryResponse } from '@/server/models/dashboard';

/**
 * Dashboard Widgets — Component Tests
 * Tests verify empty states, data rendering, and formatting behavior
 */

describe('NetWorthWidget', () => {
  it('renders "No data available yet" when latestTotal is 0', () => {
    const props: DashboardSummaryResponse['netWorth'] = {
      latestTotal: 0,
      latestCashTotal: 0,
      latestStockTotal: 0,
      latestCashDate: null,
      latestStockDate: null,
      sparklinePoints: [],
    };

    render(<NetWorthWidget netWorth={props} />);

    expect(screen.getByText('No data available yet')).toBeInTheDocument();
  });

  it('renders latest net worth and sparkline breakdown when data is present', () => {
    const props: DashboardSummaryResponse['netWorth'] = {
      latestTotal: 100000,
      latestCashTotal: 40000,
      latestStockTotal: 60000,
      latestCashDate: '2025-01-15',
      latestStockDate: '2025-01-15',
      sparklinePoints: [
        { date: '2025-01-10', value: 95000 },
        { date: '2025-01-11', value: 97000 },
        { date: '2025-01-12', value: 98000 },
        { date: '2025-01-13', value: 99000 },
        { date: '2025-01-14', value: 99500 },
        { date: '2025-01-15', value: 100000 },
      ],
    };

    render(<NetWorthWidget netWorth={props} />);

    // Check for title
    expect(screen.getByText('Net Worth')).toBeInTheDocument();

    // Check for AUD formatted amount
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();

    // Check for cash/stock breakdown labels
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Stocks')).toBeInTheDocument();
  });
});

describe('RecentTransactionsWidget', () => {
  it('renders "No transactions yet" when array is empty', () => {
    const props: DashboardSummaryResponse['recentTransactions'] = [];

    render(<RecentTransactionsWidget transactions={props} />);

    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('renders transaction list with formatted amounts and categories', () => {
    const props: DashboardSummaryResponse['recentTransactions'] = [
      {
        id: 'tx-1',
        date: '2025-01-15',
        description: 'Grocery Store Purchase',
        amount: 45.5,
        type: 'DEBIT',
        category: 'Groceries',
        bankAccountName: 'Everyday',
      },
      {
        id: 'tx-2',
        date: '2025-01-14',
        description: 'Salary Deposit',
        amount: 2500.0,
        type: 'CREDIT',
        category: 'Salary',
        bankAccountName: 'Salary Account',
      },
    ];

    render(<RecentTransactionsWidget transactions={props} />);

    // Check transaction descriptions are present
    expect(screen.getByText('Grocery Store Purchase')).toBeInTheDocument();
    expect(screen.getByText('Salary Deposit')).toBeInTheDocument();

    // Check categories are shown
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();

    // Check amounts are formatted (DEBIT red with -, CREDIT green with +)
    const debitAmount = screen.getByText(/^-\$46/);
    expect(debitAmount).toBeInTheDocument();
    expect(debitAmount).toHaveClass('text-red-600');

    const creditAmount = screen.getByText(/^\+\$2,500/);
    expect(creditAmount).toBeInTheDocument();
    expect(creditAmount).toHaveClass('text-green-600');
  });

  it('includes link to view all transactions', () => {
    const props: DashboardSummaryResponse['recentTransactions'] = [
      {
        id: 'tx-1',
        date: '2025-01-15',
        description: 'Purchase',
        amount: 45.5,
        type: 'DEBIT',
        category: 'Groceries',
        bankAccountName: null,
      },
    ];

    render(<RecentTransactionsWidget transactions={props} />);

    const link = screen.getByRole('link', { name: /View all transactions/i });
    expect(link).toHaveAttribute('href', '/cashflow/transactions');
  });
});

describe('CashflowPulseCard', () => {
  it('renders savings rate as percentage progress bar', () => {
    const props: DashboardSummaryResponse['cashflowYTD'] = {
      calendarYearId: 'cy-2025',
      calendarYearDescription: 'FY 2025',
      totalIncome: 100000,
      totalExpenses: 60000,
      netCashflow: 40000,
      savingsRate: 40.0,
    };

    render(<CashflowPulseCard cashflowYTD={props} />);

    // Check for title
    expect(screen.getByText('Cashflow Pulse')).toBeInTheDocument();

    // Check for fiscal year
    expect(screen.getByText('FY 2025')).toBeInTheDocument();

    // Check for savings rate percentage text
    expect(screen.getByText('40.0%')).toBeInTheDocument();

    // Check for progress bar element
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '40');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows positive net cashflow in green', () => {
    const props: DashboardSummaryResponse['cashflowYTD'] = {
      calendarYearId: 'cy-2025',
      calendarYearDescription: 'FY 2025',
      totalIncome: 100000,
      totalExpenses: 60000,
      netCashflow: 40000,
      savingsRate: 40.0,
    };

    render(<CashflowPulseCard cashflowYTD={props} />);

    const netAmount = screen.getByText(/\+\$40,000/);
    expect(netAmount).toBeInTheDocument();
    expect(netAmount).toHaveClass('text-green-600');
  });

  it('shows negative net cashflow in red', () => {
    const props: DashboardSummaryResponse['cashflowYTD'] = {
      calendarYearId: 'cy-2025',
      calendarYearDescription: 'FY 2025',
      totalIncome: 60000,
      totalExpenses: 100000,
      netCashflow: -40000,
      savingsRate: -40.0,
    };

    render(<CashflowPulseCard cashflowYTD={props} />);

    const netAmount = screen.getByText(/-\$40,000/);
    expect(netAmount).toBeInTheDocument();
    expect(netAmount).toHaveClass('text-red-600');
  });

  it('renders "No fiscal year data" when cashflowYTD is null', () => {
    render(<CashflowPulseCard cashflowYTD={null} />);

    expect(screen.getByText('No fiscal year data')).toBeInTheDocument();
  });

  it('handles negative savings rate with 0% progress bar display', () => {
    const props: DashboardSummaryResponse['cashflowYTD'] = {
      calendarYearId: 'cy-2025',
      calendarYearDescription: 'FY 2025',
      totalIncome: 50000,
      totalExpenses: 100000,
      netCashflow: -50000,
      savingsRate: -50.0,
    };

    render(<CashflowPulseCard cashflowYTD={props} />);

    // Should show actual percentage
    expect(screen.getByText('-50.0%')).toBeInTheDocument();

    // Progress bar should be clamped to 0
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('AssetBalanceCards', () => {
  it('renders two KPI cards with formatted AUD amounts', () => {
    render(
      <AssetBalanceCards
        latestCashTotal={50000}
        latestStockTotal={75000}
        latestCashDate="2025-01-15"
        latestStockDate="2025-01-15"
      />,
    );

    // Check card titles
    expect(screen.getByText('Bank Balance')).toBeInTheDocument();
    expect(screen.getByText('Stock Portfolio')).toBeInTheDocument();

    // Check formatted amounts
    expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$75,000/)).toBeInTheDocument();

    // Check dates are displayed
    expect(screen.getAllByText(/as of/i).length).toBeGreaterThanOrEqual(2);
  });

  it('renders "No snapshots recorded yet" when dates are null', () => {
    render(
      <AssetBalanceCards
        latestCashTotal={0}
        latestStockTotal={0}
        latestCashDate={null}
        latestStockDate={null}
      />,
    );

    // Should show "No snapshots recorded yet" twice (once for each card)
    const noDataElements = screen.getAllByText('No snapshots recorded yet');
    expect(noDataElements.length).toBe(2);
  });

  it('handles null dates gracefully', () => {
    render(
      <AssetBalanceCards
        latestCashTotal={50000}
        latestStockTotal={75000}
        latestCashDate={null}
        latestStockDate={null}
      />,
    );

    // Should show "No snapshots recorded yet" for both cards (null date hides balance row)
    const noSnapshotElements = screen.getAllByText('No snapshots recorded yet');
    expect(noSnapshotElements.length).toBe(2);
  });
});
