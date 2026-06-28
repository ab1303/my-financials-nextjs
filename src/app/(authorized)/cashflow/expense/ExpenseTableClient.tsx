'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ExternalLink, List } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';

import AIUsageCard from '@/components/AIUsageCard';
import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';
import type { CategoryBreakdown, MonthlyExpenseSummary } from '@/server/models/expense';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';

import CategoryBreakdownModal from './_components/CategoryBreakdownModal';
import ExpenseCategoryBreakdownWidget from './_components/ExpenseCategoryBreakdownWidget';

/**
 * Returns month numbers in fiscal-year order starting from `fromMonth`.
 * e.g. fromMonth=7  → [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
 *      fromMonth=1  → [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
 */
function getFiscalMonthsOrdered(fromMonth: number): number[] {
  return Array.from({ length: 12 }, (_, i) => ((fromMonth - 1 + i) % 12) + 1);
}

/** Returns the calendar year a month belongs to within the fiscal year. */
function getMonthCalendarYear(
  month: number,
  fromMonth: number,
  fromYear: number,
): number {
  return month >= fromMonth ? fromYear : fromYear + 1;
}

type DisplayRow = MonthlyExpenseSummary & { calendarYear: number };

const columnHelper = createColumnHelper<DisplayRow>();

type ExpenseTableClientProps = {
  calendarYearId: string;
  monthlySummaries: MonthlyExpenseSummary[];
  dateFrom: Date;
  dateTo: Date;
  calendarLabel: string;
  fromMonth: number;
  fromYear: number;
  bankAccountId?: string;
  categoryBreakdown: CategoryBreakdown[];
  yearDateFrom: string;  // YYYY-MM-DD
  yearDateTo: string;    // YYYY-MM-DD
  categoryGroups: CategoryGroupListItem[];
};

export default function ExpenseTableClient({
  calendarYearId,
  monthlySummaries,
  dateFrom,
  dateTo,
  calendarLabel,
  fromMonth,
  fromYear,
  bankAccountId,
  categoryBreakdown,
  yearDateFrom,
  yearDateTo,
  categoryGroups,
}: ExpenseTableClientProps) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | null>(
    null,
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    () => new Set(categoryBreakdown.map((b) => b.categoryId)),
  );
  const allCategoryIds = useMemo(
    () => categoryBreakdown.map((b) => b.categoryId),
    [categoryBreakdown],
  );
  const selectedCategoryIdsKey = useMemo(
    () => Array.from(selectedCategoryIds).sort().join(','),
    [selectedCategoryIds],
  );
  const [displayMonthlySummaries, setDisplayMonthlySummaries] = useState(
    monthlySummaries,
  );
  const [displayTotalAmount, setDisplayTotalAmount] = useState(
    monthlySummaries.reduce((sum, summary) => sum + summary.totalAmount, 0),
  );
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const allSelected =
      allCategoryIds.length > 0 &&
      selectedCategoryIds.size === allCategoryIds.length &&
      allCategoryIds.every((id) => selectedCategoryIds.has(id));

    if (allSelected) {
      setDisplayMonthlySummaries(monthlySummaries);
      setDisplayTotalAmount(
        monthlySummaries.reduce((sum, summary) => sum + summary.totalAmount, 0),
      );
      setSummaryError(null);
      return;
    }

    if (selectedCategoryIds.size === 0) {
      setDisplayMonthlySummaries(
        monthlySummaries.map((summary) => ({
          ...summary,
          totalAmount: 0,
          entryCount: 0,
        })),
      );
      setDisplayTotalAmount(0);
      setSummaryError(null);
      return;
    }

    const controller = new AbortController();
    const selectedIds = Array.from(selectedCategoryIds).sort();
    const params = new URLSearchParams({
      calendarYearId,
      expenseCategoryIds: selectedIds.join(','),
    });
    if (bankAccountId) {
      params.set('bankAccountId', bankAccountId);
    }

    async function loadFilteredSummaries() {
      const response = await fetch(
        `/api/cashflow/expense/monthly-summary?${params.toString()}`,
        {
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error('Failed to refresh filtered monthly expense totals');
      }

      const data: { monthlySummaries: MonthlyExpenseSummary[] } =
        await response.json();
      setDisplayMonthlySummaries(data.monthlySummaries);
      setDisplayTotalAmount(
        data.monthlySummaries.reduce(
          (sum, summary) => sum + summary.totalAmount,
          0,
        ),
      );
      setSummaryError(null);
    }

    loadFilteredSummaries().catch((error) => {
      if (controller.signal.aborted) return;
      console.error('Expense summary refresh failed:', error);
      setSummaryError('Unable to refresh monthly totals for the selected categories.');
    });

    return () => {
      controller.abort();
    };
  }, [
    allCategoryIds,
    bankAccountId,
    calendarYearId,
    monthlySummaries,
    selectedCategoryIdsKey,
  ]);

  // Build display rows in fiscal-year order, each annotated with its calendar year
  const orderedRows = useMemo<DisplayRow[]>(() => {
    const summaryMap = new Map(displayMonthlySummaries.map((s) => [s.month, s]));
    return getFiscalMonthsOrdered(fromMonth).map((month) => {
      const summary = summaryMap.get(month) ?? {
        month,
        totalAmount: 0,
        entryCount: 0,
      };
      return { ...summary, calendarYear: getMonthCalendarYear(month, fromMonth, fromYear) };
    });
  }, [displayMonthlySummaries, fromMonth, fromYear]);

  const columns = [
    columnHelper.accessor('month', {
      size: 200,
      header: () => <span>Month</span>,
      cell: (info) => {
        const month = info.getValue();
        const year = info.row.original.calendarYear;
        const label = `${MONTHS_MAP.get(month) ?? `Month ${month}`} ${year}`;
        return (
          <Link
            href={`/cashflow/transactions?month=${month}&year=${year}`}
            className='inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors'
            aria-label={`Open transactions for ${label}`}
          >
            <span>{label}</span>
            <ExternalLink className='h-3.5 w-3.5 opacity-70' aria-hidden='true' />
          </Link>
        );
      },
    }),
    columnHelper.accessor('totalAmount', {
      size: 200,
      header: () => <span>Total Expense</span>,
      cell: ({ renderValue }) => {
        const value = renderValue();
        return (
          <NumericFormat
            prefix='$'
            displayType='text'
            thousandSeparator
            value={value?.toFixed(2) || '0.00'}
          />
        );
      },
    }),
    columnHelper.display({
      id: 'categoryBreakdown',
      size: 150,
      header: () => <span className='inline-flex w-full justify-center'>Category Breakdown</span>,
      cell: ({ row }) => {
        const month = row.original.month;
        const year = row.original.calendarYear;
        const label = `${MONTHS_MAP.get(month) ?? `Month ${month}`} ${year}`;
        return (
          <div className='flex justify-center'>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMonth(month);
                setSelectedMonthYear(year);
              }}
              className='rounded-sm text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors'
              aria-label={`View category breakdown for ${label}`}
            >
              <List className='h-5 w-5' aria-hidden='true' />
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable<DisplayRow>({
    data: orderedRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  const totalExpenses = orderedRows.reduce(
    (sum, row) => sum + row.totalAmount,
    0,
  );

  const selectedMonthLabel =
    selectedMonth !== null && selectedMonthYear !== null
      ? `${MONTHS_MAP.get(selectedMonth) ?? `Month ${selectedMonth}`} ${selectedMonthYear}`
      : '';

  return (
    <>
      {/* Import Buttons + AI Usage Card */}
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <AIUsageCard
          importType='EXPENSE'
          dateFrom={dateFrom}
          dateTo={dateTo}
          dateLabel={calendarLabel}
        />
        <div className='flex gap-2'>
          <Link
            href='/cashflow/transactions'
            className='inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors'
          >
            Import transactions →
          </Link>
        </div>
      </div>

      <div className='mb-4 p-4 bg-muted/50 border border-border rounded-lg'>
        <div className='flex justify-between items-center gap-4'>
          <span className='text-sm font-medium text-muted-foreground'>
            Total Expenses for {calendarLabel}:
          </span>
          <span className='text-lg font-bold text-foreground'>
            <NumericFormat
              prefix='$'
              displayType='text'
              thousandSeparator
              value={displayTotalAmount.toFixed(2)}
            />
          </span>
        </div>
      </div>

      {summaryError && (
        <div className='mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
          {summaryError}
        </div>
      )}

      {/* Category Breakdown Widget */}
      <ExpenseCategoryBreakdownWidget
        breakdown={categoryBreakdown}
        yearDateFrom={yearDateFrom}
        yearDateTo={yearDateTo}
        calendarLabel={calendarLabel}
        categoryGroups={categoryGroups}
        selectedCategoryIds={selectedCategoryIds}
        onCategorySelectionChange={setSelectedCategoryIds}
      />

      <div className='overflow-x-auto'>
        <Table>
          <Table.THead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.THead.TR key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.THead.TH key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </Table.THead.TH>
                ))}
              </Table.THead.TR>
            ))}
          </Table.THead>

          <Table.TBody>
            {table.getRowModel().rows.length === 0 ? (
              <Table.TBody.TR>
                <td
                  colSpan={3}
                  className='text-center py-12 text-muted-foreground px-6 bg-muted/30'
                >
                  <div className='flex flex-col items-center'>
                    <List className='h-6 w-6 text-muted-foreground/50 mb-2' />
                    <p className='text-base font-medium text-foreground mb-1'>
                      No expenses recorded
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      Select a fiscal year to view expense records
                    </p>
                  </div>
                </td>
              </Table.TBody.TR>
            ) : (
              table.getRowModel().rows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    className='odd:bg-muted/30 hover:bg-muted/50 transition-colors'
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.TBody.TD key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Table.TBody.TD>
                    ))}
                  </tr>
                );
              })
            )}
          </Table.TBody>

          <Table.TFoot>
            <Table.TFoot.TR>
              <Table.TFoot.TH>Total</Table.TFoot.TH>
              <Table.TFoot.TH>
                <NumericFormat
                  prefix='$'
                  displayType='text'
                  thousandSeparator
                  value={totalExpenses.toFixed(2)}
                />
              </Table.TFoot.TH>
              <Table.TFoot.TH>
                {/* Empty cell for Category Breakdown column */}
              </Table.TFoot.TH>
            </Table.TFoot.TR>
          </Table.TFoot>
        </Table>
      </div>

      {/* Category Breakdown Modal */}
      {selectedMonth !== null && selectedMonthYear !== null && (
        <CategoryBreakdownModal
          calendarYearId={calendarYearId}
          month={selectedMonth}
          monthName={selectedMonthLabel}
          monthYear={selectedMonthYear}
          isOpen={true}
          categoryGroups={categoryGroups}
          onClose={() => {
            setSelectedMonth(null);
            setSelectedMonthYear(null);
          }}
        />
      )}
    </>
  );
}
