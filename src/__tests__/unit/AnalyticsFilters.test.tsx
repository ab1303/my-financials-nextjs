import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CashflowAnalyticsClient from '@/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';
import type { CalendarYearType, OptionType } from '@/types';

type TrendPoint = { income: number; expenses: number };
type SelectOption = { id: string };
type SelectGroup = { label: string; options: SelectOption[] };
type SelectWrapperProps = {
  options?: Array<SelectOption | { label: string; options: SelectOption[] }>;
  value?: SelectOption | SelectOption[];
  inputId: string;
  onChange?: (value: SelectOption[]) => void;
};

type FetchMock = {
  mockImplementation: (
    impl: (input: RequestInfo | URL) => Promise<Response>,
  ) => void;
  mockResolvedValueOnce: (value: Promise<Response> | Response) => void;
  mock: { calls: Array<[RequestInfo | URL]> };
};

const isSelectGroup = (
  value: SelectOption | SelectGroup,
): value is SelectGroup => 'label' in value;

// Mock the API
global.fetch = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the components
vi.mock(
  '@/app/(authorized)/cashflow/analytics/_components/IncomeExpenseTrendChart',
  () => ({
    IncomeExpenseTrendChart: ({ data }: { data: TrendPoint[] }) => (
      <div
        data-testid='trend-chart'
        data-count={data.length}
        data-income-total={data.reduce(
          (sum: number, point: TrendPoint) => sum + point.income,
          0,
        )}
        data-expense-total={data.reduce(
          (sum: number, point: TrendPoint) => sum + point.expenses,
          0,
        )}
      >
        Trend Chart
      </div>
    ),
  }),
);

vi.mock(
  '@/app/(authorized)/cashflow/analytics/_components/NetCashflowChart',
  () => ({
    NetCashflowChart: () => <div data-testid='net-chart'>Net Chart</div>,
  }),
);

vi.mock(
  '@/app/(authorized)/cashflow/analytics/_components/ExpenseCategoryChart',
  () => ({
    ExpenseCategoryChart: ({ data }: { data: unknown[] }) => (
      <div data-testid='expense-chart' data-count={data.length}>
        Expense Chart
      </div>
    ),
  }),
);

vi.mock(
  '@/app/(authorized)/cashflow/analytics/_components/IncomeSourceChart',
  () => ({
    IncomeSourceChart: ({ data }: { data: unknown[] }) => (
      <div data-testid='income-chart' data-count={data.length}>
        Income Chart
      </div>
    ),
  }),
);

vi.mock(
  '@/app/(authorized)/cashflow/analytics/_components/KPISummaryCards',
  () => ({
    KPISummaryCards: () => <div data-testid='kpi-cards'>KPI Cards</div>,
  }),
);

vi.mock(
  '@/app/(authorized)/cashflow/analytics/_components/AnalyticsDrillDownDrawer',
  () => ({
    default: () => <div data-testid='drill-down-drawer'>Drill Down Drawer</div>,
  }),
);

vi.mock(
  '@/app/(authorized)/cashflow/analytics/_components/ChartSkeleton',
  () => ({
    ChartSkeleton: () => <div data-testid='chart-skeleton'>Loading Chart</div>,
  }),
);

vi.mock('@/components/ui/Select', () => ({
  SelectWrapper: (props: SelectWrapperProps) => {
    const groupLabels =
      Array.isArray(props.options) && isSelectGroup(props.options[0]!)
        ? props.options
            .filter(isSelectGroup)
            .map((group) => group.label)
            .join('|')
        : '';
    const selectedIds = Array.isArray(props.value)
      ? props.value.map((option) => option.id).join('|')
      : (props.value?.id ?? '');

    return (
      <div
        data-testid={props.inputId}
        data-groups={groupLabels}
        data-selected={selectedIds}
      >
        <button
          type='button'
          data-testid={`${props.inputId}-select-first`}
          onClick={() => {
            const firstOption = Array.isArray(props.options)
              ? isSelectGroup(props.options[0]!)
                ? props.options[0].options[0]
                : props.options[0]
              : null;
            if (!firstOption) return;
            props.onChange?.([firstOption]);
          }}
        >
          select-first
        </button>
        <button
          type='button'
          data-testid={`${props.inputId}-clear`}
          onClick={() => props.onChange?.([])}
        >
          clear
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/CalendarYearPicker', () => ({
  CalendarYearPicker: ({
    onYearChange,
  }: {
    onYearChange: (id: string) => void;
  }) => (
    <div data-testid='calendar-picker'>
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

  const mockIncomeSources: OptionType[] = [
    { id: 'src-1', label: 'Salary' },
    { id: 'src-2', label: 'Freelance' },
  ];

  const mockExpenseCategories: OptionType[] = [
    { id: 'cat-1', label: 'Rent' },
    { id: 'cat-2', label: 'Groceries' },
    { id: 'cat-3', label: 'Transport' },
  ];

  const mockCategoryGroups: CategoryGroupListItem[] = [
    {
      id: 'group-1',
      userId: 'user-1',
      scope: 'EXPENSE',
      name: 'Living Costs',
      description: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      memberCount: 2,
      memberIds: ['cat-1', 'cat-2'],
    },
    {
      id: 'group-2',
      userId: 'user-1',
      scope: 'EXPENSE',
      name: 'Travel',
      description: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      memberCount: 0,
      memberIds: [],
    },
    {
      id: 'group-3',
      userId: 'user-1',
      scope: 'INCOME',
      name: 'Salary',
      description: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      memberCount: 1,
      memberIds: ['src-1'],
    },
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
    monthlyTrend: [
      {
        month: 7,
        year: 2024,
        label: 'Jul 24',
        income: 100,
        expenses: 40,
        net: 60,
      },
      {
        month: 8,
        year: 2024,
        label: 'Aug 24',
        income: 200,
        expenses: 70,
        net: 130,
      },
    ],
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
      {
        categoryId: 'cat-3',
        categoryName: 'Transport',
        amount: 150,
      },
    ],
    incomeSources: [
      {
        sourceId: 'src-1',
        sourceName: 'Salary',
        amount: 10000,
      },
      {
        sourceId: 'src-2',
        sourceName: 'Freelance',
        amount: 1200,
      },
    ],
  };

  const buildAnalyticsResponse = (input: RequestInfo | URL) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString(),
      'http://localhost',
    );

    const incomeParamPresent = url.searchParams.has('incomeCategoryIds');
    const expenseParamPresent = url.searchParams.has('expenseCategoryIds');
    const incomeParam = url.searchParams.get('incomeCategoryIds');
    const expenseParam = url.searchParams.get('expenseCategoryIds');

    const selectedIncomeIds =
      incomeParamPresent && incomeParam !== null && incomeParam.trim() !== ''
        ? incomeParam.split(',').filter(Boolean)
        : incomeParamPresent
          ? []
          : mockIncomeSources.map((source) => source.id);

    const selectedExpenseIds =
      expenseParamPresent && expenseParam !== null && expenseParam.trim() !== ''
        ? expenseParam.split(',').filter(Boolean)
        : expenseParamPresent
          ? []
          : mockExpenseCategories.map((category) => category.id);

    const incomeSources =
      selectedIncomeIds.length === 0
        ? []
        : mockAnalyticsData.incomeSources.filter((source) =>
            selectedIncomeIds.includes(source.sourceId),
          );

    const expenseCategories =
      selectedExpenseIds.length === 0
        ? []
        : mockAnalyticsData.expenseCategories.filter((category) =>
            selectedExpenseIds.includes(category.categoryId),
          );

    const incomeMultiplier =
      selectedIncomeIds.length === 0
        ? 0
        : selectedIncomeIds.length === mockIncomeSources.length
          ? 1
          : 0.5;
    const expenseMultiplier =
      selectedExpenseIds.length === 0
        ? 0
        : selectedExpenseIds.length === mockExpenseCategories.length
          ? 1
          : 0.5;

    const monthlyTrend = mockAnalyticsData.monthlyTrend.map((point) => ({
      ...point,
      income: point.income * incomeMultiplier,
      expenses: point.expenses * expenseMultiplier,
      net: point.income * incomeMultiplier - point.expenses * expenseMultiplier,
    }));

    return {
      ...mockAnalyticsData,
      monthlyTrend,
      incomeSources,
      expenseCategories,
      kpis: {
        ...mockAnalyticsData.kpis,
        totalIncome: mockAnalyticsData.kpis.totalIncome * incomeMultiplier,
        totalExpenses: mockAnalyticsData.kpis.totalExpenses * expenseMultiplier,
        netCashflow:
          mockAnalyticsData.kpis.totalIncome * incomeMultiplier -
          mockAnalyticsData.kpis.totalExpenses * expenseMultiplier,
        savingsRate:
          mockAnalyticsData.kpis.totalIncome * incomeMultiplier > 0
            ? ((mockAnalyticsData.kpis.totalIncome * incomeMultiplier -
                mockAnalyticsData.kpis.totalExpenses * expenseMultiplier) /
                (mockAnalyticsData.kpis.totalIncome * incomeMultiplier)) *
              100
            : 0,
        avgMonthlyIncome:
          mockAnalyticsData.kpis.avgMonthlyIncome * incomeMultiplier,
        avgMonthlyExpenses:
          mockAnalyticsData.kpis.avgMonthlyExpenses * expenseMultiplier,
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as unknown as FetchMock).mockImplementation(
      (input: RequestInfo | URL) =>
        Promise.resolve(
          new Response(JSON.stringify(buildAnalyticsResponse(input)), {
            status: 200,
          }),
        ),
    );
  });

  it('should render the grouped expense category selector', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId='year-1'
        defaultCalendarType='FISCAL'
        bankOptions={mockBankOptions}
        categoryGroups={mockCategoryGroups}
        incomeSources={mockIncomeSources}
        expenseCategories={mockExpenseCategories}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('income-category-filter')).toBeInTheDocument();
      expect(screen.getByTestId('expense-category-filter')).toBeInTheDocument();
    });

    expect(screen.getByTestId('income-category-filter')).toHaveAttribute(
      'data-groups',
      'Salary|Ungrouped',
    );
    expect(screen.getByTestId('expense-category-filter')).toHaveAttribute(
      'data-groups',
      'Living Costs|Ungrouped',
    );
    await waitFor(() => {
      expect(screen.getByTestId('income-category-filter')).toHaveAttribute(
        'data-selected',
        'src-1|src-2',
      );
      expect(screen.getByTestId('expense-category-filter')).toHaveAttribute(
        'data-selected',
        'cat-1|cat-2|cat-3',
      );
      expect(screen.getByTestId('income-chart')).toHaveAttribute(
        'data-count',
        '2',
      );
      expect(screen.getByTestId('expense-chart')).toHaveAttribute(
        'data-count',
        '3',
      );
    });
  });

  it('should render categories grouped by authored group plus Ungrouped', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId='year-1'
        defaultCalendarType='FISCAL'
        bankOptions={mockBankOptions}
        categoryGroups={mockCategoryGroups}
        incomeSources={mockIncomeSources}
        expenseCategories={mockExpenseCategories}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('income-category-filter')).toBeInTheDocument();
      expect(screen.getByTestId('expense-category-filter')).toBeInTheDocument();
    });

    expect(screen.getByTestId('income-category-filter')).toHaveAttribute(
      'data-groups',
      'Salary|Ungrouped',
    );
    expect(screen.getByTestId('expense-category-filter')).toHaveAttribute(
      'data-groups',
      'Living Costs|Ungrouped',
    );
  });

  it('should include initial fetch with calendarYearId parameter', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId='year-1'
        defaultCalendarType='FISCAL'
        bankOptions={mockBankOptions}
        categoryGroups={mockCategoryGroups}
        incomeSources={mockIncomeSources}
        expenseCategories={mockExpenseCategories}
      />,
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const call = String(
      (global.fetch as unknown as FetchMock).mock.calls[0]?.[0] ?? '',
    );
    expect(call).toContain('calendarYearId=year-1');
  });

  it('should include category ids in the initial fetch', async () => {
    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId='year-1'
        defaultCalendarType='FISCAL'
        bankOptions={mockBankOptions}
        categoryGroups={mockCategoryGroups}
        incomeSources={mockIncomeSources}
        expenseCategories={mockExpenseCategories}
      />,
    );

    // Wait for initial render
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const firstCall = String(
      (global.fetch as unknown as FetchMock).mock.calls[0]?.[0] ?? '',
    );
    expect(firstCall).toContain('incomeCategoryIds=src-1%2Csrc-2');
    expect(firstCall).toContain('expenseCategoryIds=cat-1%2Ccat-2%2Ccat-3');
  });

  it('should render an empty grouped selector when no categories are available', async () => {
    (global.fetch as unknown as FetchMock).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...mockAnalyticsData,
          expenseCategories: [],
        }),
        { status: 200 },
      ),
    );

    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId='year-1'
        defaultCalendarType='FISCAL'
        bankOptions={[]}
        categoryGroups={[]}
        incomeSources={[]}
        expenseCategories={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('expense-category-filter')).toBeInTheDocument();
    });

    expect(screen.getByTestId('expense-category-filter')).toHaveAttribute(
      'data-groups',
      '',
    );
  });

  it('should refetch analytics when category selections change', async () => {
    const user = userEvent.setup();

    render(
      <CashflowAnalyticsClient
        calendarYears={mockCalendarYears}
        defaultCalendarYearId='year-1'
        defaultCalendarType='FISCAL'
        bankOptions={mockBankOptions}
        categoryGroups={mockCategoryGroups}
        incomeSources={mockIncomeSources}
        expenseCategories={mockExpenseCategories}
      />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(screen.getByTestId('trend-chart')).toHaveAttribute(
      'data-income-total',
      '300',
    );
    expect(screen.getByTestId('trend-chart')).toHaveAttribute(
      'data-expense-total',
      '110',
    );

    await user.click(screen.getByTestId('income-category-filter-select-first'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('income-chart')).toHaveAttribute(
        'data-count',
        '1',
      );
    });

    await user.click(screen.getByTestId('income-category-filter-clear'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId('trend-chart')).toHaveAttribute(
        'data-income-total',
        '0',
      );
      expect(screen.getByTestId('trend-chart')).toHaveAttribute(
        'data-expense-total',
        '110',
      );
      expect(screen.getByTestId('income-chart')).toHaveAttribute(
        'data-count',
        '0',
      );
      expect(screen.getByTestId('expense-chart')).toHaveAttribute(
        'data-count',
        '3',
      );
    });

    await user.click(screen.getByTestId('expense-category-filter-clear'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(screen.getByTestId('trend-chart')).toHaveAttribute(
        'data-income-total',
        '0',
      );
      expect(screen.getByTestId('trend-chart')).toHaveAttribute(
        'data-expense-total',
        '0',
      );
      expect(screen.getByTestId('expense-chart')).toHaveAttribute(
        'data-count',
        '0',
      );
    });
  });
});
