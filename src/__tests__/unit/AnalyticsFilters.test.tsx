import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CashflowAnalyticsClient from '@/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient';
import type { CalendarYearType, OptionType } from '@/types';

// Mock the API
global.fetch = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the components
vi.mock('@/app/(authorized)/cashflow/analytics/_components/IncomeExpenseTrendChart', () => ({
  IncomeExpenseTrendChart: () => <div data-testid="trend-chart">Trend Chart</div>,
}));

vi.mock('@/app/(authorized)/cashflow/analytics/_components/NetCashflowChart', () => ({
  NetCashflowChart: () => <div data-testid="net-chart">Net Chart</div>,
}));

vi.mock('@/app/(authorized)/cashflow/analytics/_components/ExpenseCategoryChart', () => ({
  ExpenseCategoryChart: () => <div data-testid="expense-chart">Expense Chart</div>,
}));

vi.mock('@/app/(authorized)/cashflow/analytics/_components/IncomeSourceChart', () => ({
  IncomeSourceChart: () => <div data-testid="income-chart">Income Chart</div>,
}));

vi.mock('@/app/(authorized)/cashflow/analytics/_components/KPISummaryCards', () => ({
  KPISummaryCards: () => <div data-testid="kpi-cards">KPI Cards</div>,
}));

vi.mock('@/app/(authorized)/cashflow/analytics/_components/AnalyticsDrillDownDrawer', () => ({
  default: () => <div data-testid="drill-down-drawer">Drill Down Drawer</div>,
}));

vi.mock('@/app/(authorized)/cashflow/analytics/_components/ChartSkeleton', () => ({
  ChartSkeleton: () => <div data-testid="chart-skeleton">Loading Chart</div>,
}));

vi.mock('@/components/CalendarYearPicker', () => ({
  CalendarYearPicker: ({ onYearChange }: any) => (
    <div data-testid="calendar-picker">
      <button onClick={() => onYearChange('year-1')}>Pick Year</button>
    </div>
  ),
}));

describe('AnalyticsFilters - Grouped Category Selectors', () => {
  const mockCalendarYears: CalendarYearType[] = [
    {
      id: 'year-1',
      fromYear: 2024,
      fromMonth: 7,
      toYear: 2025,
      toMonth: 6,
      description: 'FY2024-25',
      lockedAt: null,
      type: 'FISCAL',
    },
  ];

  const mockBankOptions: OptionType[] = [
    { id: 'bank-1', label: 'Bank A' },
    { id: 'bank-2', label: 'Bank B' },
  ];

  const mockIncomeGroupOptions: OptionType[] = [
    { id: 'income-group-1', label: 'Salary' },
    { id: 'income-group-2', label: 'Freelance' },
  ];

  const mockExpenseGroupOptions: OptionType[] = [
    { id: 'expense-group-1', label: 'Living Expenses' },
    { id: 'expense-group-2', label: 'Entertainment' },
  ];

  const mockAnalyticsData = {
    kpis: {
      totalIncome: 10000,
      totalExpenses: 5000,
      netCashflow: 5000,
      savingsRate: 50,
      avgMonthlyIncome: 833.33,
      avgMonthlyExpenses: 416.67,
    },
    monthlyTrend: [],
    expenseCategories: [
      {
        categoryId: 'cat-1',
        categoryName: 'Rent',
        amount: 1200,
      },
      {
        categoryId: 'cat-2',
        categoryName: 'Groceries',
        amount: 300,
      },
    ],
    incomeSources: [
      {
        sourceId: 'src-1',
        sourceName: 'Salary',
        amount: 10000,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(mockAnalyticsData), { status: 200 })
    );
  });

  it('should render income and expense group selector labels', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId="year-1"
        defaultCalendarType="FISCAL"
        bankOptions={mockBankOptions}
        incomeGroupOptions={mockIncomeGroupOptions}
        expenseGroupOptions={mockExpenseGroupOptions}
      />
    );

    // Wait for labels to appear
    await waitFor(() => {
      const labels = screen.getAllByText(/Income groups/i);
      expect(labels.length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Expense groups/i).length).toBeGreaterThan(0);
  });

  it('should render category group selectors in the filter bar', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId="year-1"
        defaultCalendarType="FISCAL"
        bankOptions={mockBankOptions}
        incomeGroupOptions={mockIncomeGroupOptions}
        expenseGroupOptions={mockExpenseGroupOptions}
      />
    );

    // Wait for the filter inputs to appear
    await waitFor(() => {
      const inputs = screen.getAllByRole('combobox');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('should include initial fetch with calendarYearId parameter', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId="year-1"
        defaultCalendarType="FISCAL"
        bankOptions={mockBankOptions}
        incomeGroupOptions={mockIncomeGroupOptions}
        expenseGroupOptions={mockExpenseGroupOptions}
      />
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const call = (global.fetch as any).mock.calls[0][0] as string;
    expect(call).toContain('calendarYearId=year-1');
  });

  it('should pass empty group parameters initially', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId="year-1"
        defaultCalendarType="FISCAL"
        bankOptions={mockBankOptions}
        incomeGroupOptions={mockIncomeGroupOptions}
        expenseGroupOptions={mockExpenseGroupOptions}
      />
    );

    // Wait for initial render
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // The initial call should not include group IDs or have empty values
    const firstCall = (global.fetch as any).mock.calls[0][0] as string;
    expect(firstCall).not.toContain('incomeGroupIds=');
    expect(firstCall).not.toContain('expenseGroupIds=');
  });

  it('should hide bank/group selectors when no options provided', () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId="year-1"
        defaultCalendarType="FISCAL"
        bankOptions={[]}
        incomeGroupOptions={[]}
        expenseGroupOptions={[]}
      />
    );

    // Should not show labels when no options available
    expect(screen.queryByText('Income groups')).not.toBeInTheDocument();
    expect(screen.queryByText('Expense groups')).not.toBeInTheDocument();
  });
});
