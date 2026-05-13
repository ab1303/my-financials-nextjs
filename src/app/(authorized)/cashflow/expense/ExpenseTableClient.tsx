'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

const columnHelper = createColumnHelper<MonthlyExpenseSummary>();

type ExpenseTableClientProps = {
  calendarYearId: string;
  monthlySummaries: MonthlyExpenseSummary[];
  dateFrom: Date;
  dateTo: Date;
  calendarLabel: string;
};

export default function ExpenseTableClient({
  calendarYearId,
  monthlySummaries,
  dateFrom,
  dateTo,
  calendarLabel,
}: ExpenseTableClientProps) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const columns = [
    columnHelper.accessor('month', {
      size: 200,
      header: () => <span>Month</span>,
      cell: (info) =>
        MONTHS_MAP.get(info.getValue()) || `Month ${info.getValue()}`,
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
        return (
          <div className='flex justify-center'>
            <button
              onClick={() => setSelectedMonth(row.original.month)}
              className='text-primary hover:text-primary/80 transition-colors'
              aria-label={`View category breakdown for ${MONTHS_MAP.get(row.original.month)}`}
            >
              <List className='h-5 w-5' />
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable<MonthlyExpenseSummary>({
    data: monthlySummaries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  // Calculate total for footer
  const totalExpenses = monthlySummaries.reduce(
    (sum, month) => sum + month.totalAmount,
    0,
  );

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
              table.getRowModel().rows.map((row) => (
                <Table.TBody.TR key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <Table.TBody.TD key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.TBody.TD>
                  ))}
                </Table.TBody.TR>
              ))
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
      {selectedMonth !== null && (
        <CategoryBreakdownModal
          calendarYearId={calendarYearId}
          month={selectedMonth}
          monthName={MONTHS_MAP.get(selectedMonth) || `Month ${selectedMonth}`}
          isOpen={true}
          onClose={() => setSelectedMonth(null)}
        />
      )}

    </>
  );
}
