'use client';

import type { CalendarEnumType } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import type { SingleValue } from 'react-select';

import { CalendarYearPicker } from '@/components/CalendarYearPicker';
import { CategoryGroupRollupPanel } from '@/components/ui/CategoryGroupRollupPanel';
import { Label } from '@/components/ui/Label';
import { SelectWrapper as Select } from '@/components/ui/Select';
import type {
  CashflowAnalyticsData,
  MonthlyTrendPoint,
} from '@/server/models/cashflow-analytics';
import type { CategoryBreakdown } from '@/server/models/expense';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';
import type { CalendarYearType, OptionType } from '@/types';

import AnalyticsDrillDownDrawer, {
  type DrillDownFilter,
} from './AnalyticsDrillDownDrawer';
import { ChartSkeleton } from './ChartSkeleton';
import { ExpenseCategoryChart } from './ExpenseCategoryChart';
import { ExpenseGroupSummaryChart } from './ExpenseGroupSummaryChart';
import { IncomeExpenseTrendChart } from './IncomeExpenseTrendChart';
import { IncomeSourceChart } from './IncomeSourceChart';
import { NetCashflowChart } from './NetCashflowChart';

type CashflowAnalyticsClientProps = {
  calendarYears: CalendarYearType[];
  defaultCalendarYearId: string;
  defaultCalendarType: CalendarEnumType;
  bankOptions: OptionType[];
  categoryGroups: CategoryGroupListItem[];
  incomeSources: OptionType[];
  expenseCategories: OptionType[];
};

export default function CashflowAnalyticsClient({
  calendarYears,
  defaultCalendarYearId,
  defaultCalendarType,
  bankOptions,
  categoryGroups,
  incomeSources,
  expenseCategories,
}: CashflowAnalyticsClientProps) {
  const [selectedYearId, setSelectedYearId] = useState<string>(
    defaultCalendarYearId,
  );
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedIncomeSourceIds, setSelectedIncomeSourceIds] = useState<
    string[]
  >(() => incomeSources.map((source) => source.id));
  const [data, setData] = useState<CashflowAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [drillDownFilter, setDrillDownFilter] =
    useState<DrillDownFilter | null>(null);
  const [selectedExpenseCategoryIds, setSelectedExpenseCategoryIds] = useState<
    string[]
  >(() => expenseCategories.map((category) => category.id));

  const selectedBank = bankOptions.find((b) => b.id === selectedBankId) ?? null;

  // Get the year number from the selected calendar year
  const selectedYear = calendarYears.find((y) => y.id === selectedYearId);
  const yearNumber = selectedYear?.fromYear ?? new Date().getFullYear();

  const incomeCategoryIdsParam = selectedIncomeSourceIds.join(',');
  const expenseCategoryIdsParam = selectedExpenseCategoryIds.join(',');

  useEffect(() => {
    if (!selectedYearId) return;

    let cancelled = false;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ calendarYearId: selectedYearId });
        if (selectedBankId) params.set('bankAccountId', selectedBankId);
        params.set('incomeCategoryIds', incomeCategoryIdsParam);
        params.set('expenseCategoryIds', expenseCategoryIdsParam);

        const res = await fetch(`/api/cashflow/analytics?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json: CashflowAnalyticsData = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load analytics',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, [
    incomeCategoryIdsParam,
    expenseCategoryIdsParam,
    selectedBankId,
    selectedYearId,
  ]);

  const handleYearChange = (yearId: string | null) => {
    if (yearId) setSelectedYearId(yearId);
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

  const filteredIncomeSources = useMemo(
    () => data?.incomeSources ?? [],
    [data?.incomeSources],
  );

  const filteredExpenseCategories = useMemo(
    () => data?.expenseCategories ?? [],
    [data?.expenseCategories],
  );
  const incomeBreakdown = useMemo<CategoryBreakdown[]>(() => {
    const normalize = (value: string) => value.trim().toLowerCase();
    const byLabel = new Map(
      incomeSources.map((source) => [normalize(source.label), source.id]),
    );
    const mapped: CategoryBreakdown[] = [];
    for (const source of filteredIncomeSources) {
      const matchedId = byLabel.get(normalize(source.source));
      if (!matchedId) continue;
      mapped.push({
        categoryId: matchedId,
        categoryName: source.source,
        amount: source.amount,
        percentage: source.percentage,
      });
    }
    return mapped;
  }, [filteredIncomeSources, incomeSources]);

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

          {/* Main grouped category filter */}
          <div className='grid gap-4 lg:grid-cols-2'>
            <CategoryGroupRollupPanel
              label='Income categories'
              scope='INCOME'
              breakdown={incomeBreakdown}
              allCategories={incomeSources}
              categoryGroups={categoryGroups}
              showEmptyGroups
              selectedCategoryIds={new Set(selectedIncomeSourceIds)}
              onSelectionChange={(ids) =>
                setSelectedIncomeSourceIds(Array.from(ids))
              }
            />
            <CategoryGroupRollupPanel
              label='Expense categories'
              scope='EXPENSE'
              breakdown={data?.expenseCategories ?? []}
              allCategories={expenseCategories}
              categoryGroups={categoryGroups}
              selectedCategoryIds={new Set(selectedExpenseCategoryIds)}
              onSelectionChange={(ids) =>
                setSelectedExpenseCategoryIds(Array.from(ids))
              }
              emptyStateHref='/cashflow/category-groups'
            />
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
              data={filteredIncomeSources}
              onSourceClick={handleSourceClick}
            />
          </>
        )}
      </div>

      {/* Group Spending Summary (shown when category groups exist) */}
      {!loading &&
        categoryGroups.filter((g) => g.scope === 'EXPENSE').length > 0 && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <ExpenseGroupSummaryChart
              expenseCategories={filteredExpenseCategories}
              categoryGroups={categoryGroups}
            />
          </div>
        )}

      {/* Drill-Down Drawer */}
      <AnalyticsDrillDownDrawer
        open={drillDownFilter !== null}
        onClose={() => setDrillDownFilter(null)}
        filter={drillDownFilter}
      />
    </div>
  );
}
