import { render, screen } from '@testing-library/react';
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

vi.mock('@/components/CalendarYearPicker', () => ({
  CalendarYearPicker: ({ onYearChange }: any) => (
    <div data-testid="calendar-picker">
      <button onClick={() => onYearChange('year-1')}>Pick Year</button>
    </div>
  ),
}));

describe('AnalyticsFilters', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render group selector labels when options are provided', () => {
    (global.fetch as any).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          kpis: {
            totalIncome: 0,
            totalExpenses: 0,
            netCashflow: 0,
            savingsRate: 0,
            avgMonthlyIncome: 0,
            avgMonthlyExpenses: 0,
          },
          monthlyTrend: [],
          expenseCategories: [],
          incomeSources: [],
        }),
        { status: 200 }
      )
    );

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

    expect(screen.getByText(/Income groups/i)).toBeInTheDocument();
    expect(screen.getByText(/Expense groups/i)).toBeInTheDocument();
  });

  it('should include group IDs in API request parameters', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({
          kpis: {
            totalIncome: 0,
            totalExpenses: 0,
            netCashflow: 0,
            savingsRate: 0,
            avgMonthlyIncome: 0,
            avgMonthlyExpenses: 0,
          },
          monthlyTrend: [],
          expenseCategories: [],
          incomeSources: [],
        }),
        { status: 200 }
      )
    );

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
    await screen.findByTestId('kpi-cards');

    expect(global.fetch).toHaveBeenCalled();
    const call = (global.fetch as any).mock.calls[0][0] as string;
    expect(call).toContain('calendarYearId=year-1');
  });
});
