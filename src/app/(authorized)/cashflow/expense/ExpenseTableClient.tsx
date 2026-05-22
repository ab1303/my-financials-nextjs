'use client';

import { useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { List } from 'lucide-react';
import Link from 'next/link';

import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';
import type { MonthlyExpenseSummary } from '@/server/models/expense';
import AIUsageCard from '@/components/AIUsageCard';

import CategoryBreakdownModal from './_components/CategoryBreakdownModal';

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
};

export default function ExpenseTableClient({
  calendarYearId,
  monthlySummaries,
  dateFrom,
  dateTo,
  calendarLabel,
  fromMonth,
  fromYear,
}: ExpenseTableClientProps) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | null>(
    null,
  );

  // Build display rows in fiscal-year order, each annotated with its calendar year
  const orderedRows = useMemo<DisplayRow[]>(() => {
    const summaryMap = new Map(monthlySummaries.map((s) => [s.month, s]));
    return getFiscalMonthsOrdered(fromMonth).map((month) => {
      const summary = summaryMap.get(month) ?? {
        month,
        totalAmount: 0,
        entryCount: 0,
      };
      return { ...summary, calendarYear: getMonthCalendarYear(month, fromMonth, fromYear) };
    });
  }, [monthlySummaries, fromMonth, fromYear]);

  const columns = [
    columnHelper.accessor('month', {
      size: 200,
      header: () => <span>Month</span>,
      cell: (info) => {
        const month = info.getValue();
        const year = info.row.original.calendarYear;
        return `${MONTHS_MAP.get(month) ?? `Month ${month}`} ${year}`;
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
      header: () => <span>Category Breakdown</span>,
      cell: ({ row }) => {
        const month = row.original.month;
        const year = row.original.calendarYear;
        const label = `${MONTHS_MAP.get(month) ?? `Month ${month}`} ${year}`;
        return (
          <div className='flex justify-center'>
            <button
              onClick={() => {
                setSelectedMonth(month);
                setSelectedMonthYear(year);
              }}
              className='text-primary hover:text-primary/80 transition-colors'
              aria-label={`View category breakdown for ${label}`}
            >
              <List className='h-5 w-5' />
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
                const month = row.original.month;
                const year = row.original.calendarYear;
                return (
                  <tr
                    key={row.id}
                    className="odd:bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      window.location.href = `/cashflow/transactions?month=${month}&year=${year}`;
                    }}
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
          onClose={() => {
            setSelectedMonth(null);
            setSelectedMonthYear(null);
          }}
        />
      )}
    </>
  );
}
