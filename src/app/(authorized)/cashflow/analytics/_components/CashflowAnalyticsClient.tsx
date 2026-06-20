'use client';

import type { CalendarEnumType } from '@prisma/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MultiValue, SingleValue } from 'react-select';

import { CalendarYearPicker } from '@/components/CalendarYearPicker';
import { FiltersPanel } from '@/components/ui/filters';
import { Label } from '@/components/ui/Label';
import { SelectWrapper as Select } from '@/components/ui/Select';
import type { CategoryGroup } from '@/lib/mockFilterData';
import type {
  CashflowAnalyticsData,
  MonthlyTrendPoint,
} from '@/server/models/cashflow-analytics';
import type { CalendarYearType, OptionType } from '@/types';

import AnalyticsDrillDownDrawer, {
  type DrillDownFilter,
} from './AnalyticsDrillDownDrawer';
import { ChartSkeleton } from './ChartSkeleton';
import { ExpenseCategoryChart } from './ExpenseCategoryChart';
import { IncomeExpenseTrendChart } from './IncomeExpenseTrendChart';
import { IncomeSourceChart } from './IncomeSourceChart';
import { KPISummaryCards } from './KPISummaryCards';
import { NetCashflowChart } from './NetCashflowChart';

type CashflowAnalyticsClientProps = {
  calendarYears: CalendarYearType[];
  defaultCalendarYearId: string;
  defaultCalendarType: CalendarEnumType;
  bankOptions: OptionType[];
  incomeGroupOptions: OptionType[];
  expenseGroupOptions: OptionType[];
};

export default function CashflowAnalyticsClient({
  calendarYears,
  defaultCalendarYearId,
  defaultCalendarType,
  bankOptions,
  incomeGroupOptions,
  expenseGroupOptions,
}: CashflowAnalyticsClientProps) {
  const [selectedYearId, setSelectedYearId] = useState<string>(
    defaultCalendarYearId,
  );
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedIncomeGroupIds, setSelectedIncomeGroupIds] = useState<
    string[]
  >([]);
  const [selectedExpenseGroupIds, setSelectedExpenseGroupIds] = useState<
    string[]
  >([]);
  const [data, setData] = useState<CashflowAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [drillDownFilter, setDrillDownFilter] =
    useState<DrillDownFilter | null>(null);
  const [selectedExpenseCategoryIds, setSelectedExpenseCategoryIds] = useState<
    string[]
  >([]);

  const selectedBank = bankOptions.find((b) => b.id === selectedBankId) ?? null;
  const selectedIncomeGroups = incomeGroupOptions.filter((g) =>
    selectedIncomeGroupIds.includes(g.id),
  );
  const selectedExpenseGroups = expenseGroupOptions.filter((g) =>
    selectedExpenseGroupIds.includes(g.id),
  );

  // Get the year number from the selected calendar year
  const selectedYear = calendarYears.find((y) => y.id === selectedYearId);
  const yearNumber = selectedYear?.fromYear ?? new Date().getFullYear();

  const fetchAnalytics = useCallback(
    async (
      yearId: string,
      bankId: string | null,
      incomeGroupIds: string[],
      expenseGroupIds: string[],
    ) => {
      if (!yearId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ calendarYearId: yearId });
        if (bankId) params.set('bankAccountId', bankId);
        if (incomeGroupIds.length > 0) {
          params.set('incomeGroupIds', incomeGroupIds.join(','));
        }
        if (expenseGroupIds.length > 0) {
          params.set('expenseGroupIds', expenseGroupIds.join(','));
        }
        const res = await fetch(`/api/cashflow/analytics?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json: CashflowAnalyticsData = await res.json();
        setData(json);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load analytics',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchAnalytics(
      selectedYearId,
      selectedBankId,
      selectedIncomeGroupIds,
      selectedExpenseGroupIds,
    );
  }, [
    fetchAnalytics,
    selectedYearId,
    selectedBankId,
    selectedIncomeGroupIds,
    selectedExpenseGroupIds,
  ]);

  const handleYearChange = (yearId: string | null) => {
    if (yearId) setSelectedYearId(yearId);
  };

  const handleIncomeGroupChange = (value: MultiValue<OptionType>) => {
    setSelectedIncomeGroupIds(value.map((v) => v.id));
  };

  const handleExpenseGroupChange = (value: MultiValue<OptionType>) => {
    setSelectedExpenseGroupIds(value.map((v) => v.id));
  };

  const handleMonthClick = (
    point: MonthlyTrendPoint,
    series: 'income' | 'expenses',
  ) => {
    setDrillDownFilter({
      type: 'month',
      month: point.month,
      year: point.year,
      label: point.label,
      transactionType: series === 'income' ? 'CREDIT' : 'DEBIT',
    });
  };

  const handleCategoryClick = (categoryName: string) => {
    setDrillDownFilter({
      type: 'category',
      categoryName,
      year: yearNumber,
      label: categoryName,
      transactionType: 'DEBIT',
    });
  };

  const handleSourceClick = (sourceName: string) => {
    setDrillDownFilter({
      type: 'source',
      source: sourceName,
      year: yearNumber,
      label: `${sourceName} income`,
      transactionType: 'CREDIT',
    });
  };

  /**
   * Phase 2: Build grouped expense categories with Ungrouped bucket
   * Categories from API are organized into groups based on their assignment
   * For now, all categories go into a single "Expense Categories" group
   * Future: Will aggregate by authored category groups from server
   */
  const expenseFilterGroups = useMemo<CategoryGroup[]>(() => {
    const categories = data?.expenseCategories ?? [];

    if (categories.length === 0) return [];

    // Group categories by their group assignment (currently all in one group)
    const groupedByAssignment = new Map<string, typeof categories>();
    const ungrouped: typeof categories = [];

    categories.forEach((category) => {
      // For now, treat all as ungrouped until server provides group assignments
      ungrouped.push(category);
    });

    const groups: CategoryGroup[] = [];

    // Add main category group if any exist
    if (categories.length > 0) {
      groups.push({
        id: 'expense-categories',
        name: 'Expense Categories',
        categories: categories.map((category) => ({
          id: category.categoryId || category.categoryName,
          name: category.categoryName,
          type: 'expense',
          amount: category.amount,
        })),
      });
    }

    // Add ungrouped bucket (for future use when some categories are grouped)
    if (ungrouped.length > 0 && groupedByAssignment.size > 0) {
      groups.push({
        id: 'g-ungrouped',
        name: 'Ungrouped',
        categories: ungrouped.map((category) => ({
          id: category.categoryId || category.categoryName,
          name: category.categoryName,
          type: 'expense',
          amount: category.amount,
        })),
      });
    }

    return groups;
  }, [data?.expenseCategories]);

  const filteredExpenseCategories = useMemo(() => {
    const categories = data?.expenseCategories ?? [];
    if (expenseFilterGroups.length === 0) return categories;

    const selected = new Set(selectedExpenseCategoryIds);
    return categories.filter((category) => selected.has(category.categoryId));
  }, [
    data?.expenseCategories,
    expenseFilterGroups.length,
    selectedExpenseCategoryIds,
  ]);

  useEffect(() => {
    const allExpenseCategoryIds = expenseFilterGroups.flatMap((group) =>
      group.categories.map((category) => category.id),
    );
    setSelectedExpenseCategoryIds(allExpenseCategoryIds);
  }, [expenseFilterGroups]);

  return (
    <div className='space-y-6'>
      {/* Filter Bar */}
      <div className='rounded-xl border border-border bg-card shadow p-4'>
        <div className='flex flex-col gap-4'>
          {/* First Row: Calendar Year + Bank */}
          <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'>
            {/* Calendar Year Picker */}
            <CalendarYearPicker
              applicableTypes={['FISCAL', 'ANNUAL']}
              calendarYears={calendarYears}
              selectedYearId={selectedYearId}
              defaultType={defaultCalendarType}
              onYearChange={handleYearChange}
            />

            {/* Bank Account Filter */}
            {bankOptions.length > 0 && (
              <div className='space-y-1.5'>
                <Label htmlFor='bank-filter'>Bank Account</Label>
                <Select<OptionType>
                  instanceId='bank-filter'
                  inputId='bank-filter'
                  options={bankOptions}
                  value={selectedBank}
                  onChange={(opt: SingleValue<OptionType>) =>
                    setSelectedBankId(opt?.id ?? null)
                  }
                  isClearable
                  placeholder='All accounts'
                  className='w-56'
                  getOptionValue={(opt) => opt.id}
                  getOptionLabel={(opt) => opt.label}
                />
              </div>
            )}
          </div>

          {/* Second Row: Income Groups + Expense Groups */}
          <div className='flex flex-col sm:flex-row gap-4'>
            {/* Income Groups */}
            {incomeGroupOptions.length > 0 && (
              <div className='space-y-1.5 flex-1'>
                <Label htmlFor='income-groups'>Income groups</Label>
                <Select<OptionType, true>
                  instanceId='income-groups'
                  inputId='income-groups'
                  options={incomeGroupOptions}
                  value={selectedIncomeGroups}
                  onChange={handleIncomeGroupChange}
                  isMulti
                  isClearable
                  placeholder='All income groups'
                  className='w-full'
                  getOptionValue={(opt) => opt.id}
                  getOptionLabel={(opt) => opt.label}
                />
              </div>
            )}

            {/* Expense Groups */}
            {expenseGroupOptions.length > 0 && (
              <div className='space-y-1.5 flex-1'>
                <Label htmlFor='expense-groups'>Expense groups</Label>
                <Select<OptionType, true>
                  instanceId='expense-groups'
                  inputId='expense-groups'
                  options={expenseGroupOptions}
                  value={selectedExpenseGroups}
                  onChange={handleExpenseGroupChange}
                  isMulti
                  isClearable
                  placeholder='All expense groups'
                  className='w-full'
                  getOptionValue={(opt) => opt.id}
                  getOptionLabel={(opt) => opt.label}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
          <p className='text-red-800 dark:text-red-300 text-sm font-medium'>
            Failed to load analytics: {error}
          </p>
        </div>
      )}

      {/* KPI Cards */}
      {/* <KPISummaryCards kpis={data?.kpis ?? null} loading={loading} /> */}

      {/* Category Filters */}
      {!loading && expenseFilterGroups.length > 0 && (
        <section className="rounded-xl border border-border bg-card shadow p-4">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-foreground">Expense category filters</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Use the grouped selector to include/exclude expense categories. KPI and trend totals reflect the full aggregate.
            </p>
          </div>
          <FiltersPanel
            initialGroups={expenseFilterGroups}
            defaultSelectAll
            onSelectionChange={setSelectedExpenseCategoryIds}
            useGroupedSelect={true}
          />
        </section>
      )}

      {/* Main Trend Chart */}
      {loading ? (
        <ChartSkeleton height={320} />
      ) : (
        <IncomeExpenseTrendChart
          data={data?.monthlyTrend ?? []}
          onMonthClick={handleMonthClick}
        />
      )}

      {/* Net Cashflow Chart */}
      {loading ? (
        <ChartSkeleton height={280} />
      ) : (
        <NetCashflowChart data={data?.monthlyTrend ?? []} />
      )}

      {/* Category + Source Breakdown Side-by-Side */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {loading ? (
          <>
            <ChartSkeleton height={350} />
            <ChartSkeleton height={350} />
          </>
        ) : (
          <>
            <ExpenseCategoryChart
              data={filteredExpenseCategories}
              calendarYearId={selectedYearId}
              onCategoryClick={handleCategoryClick}
            />
            <IncomeSourceChart
              data={data?.incomeSources ?? []}
              onSourceClick={handleSourceClick}
            />
          </>
        )}
      </div>

      {/* Drill-Down Drawer */}
      <AnalyticsDrillDownDrawer
        open={drillDownFilter !== null}
        onClose={() => setDrillDownFilter(null)}
        filter={drillDownFilter}
      />
    </div>
  );
}
