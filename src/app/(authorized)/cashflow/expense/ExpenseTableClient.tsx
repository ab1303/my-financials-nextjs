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
import { FaListUl } from 'react-icons/fa';
import { FiUpload } from 'react-icons/fi';

import Table from '@/components/table';
import { Button } from '@/components/ui/button';
import MONTHS_MAP from '@/constants/map';
import type { MonthlyExpenseSummary } from '@/server/models/expense';

import CategoryBreakdownModal from './_components/CategoryBreakdownModal';
import AIImportWizard from './_components/ai-import/AIImportWizard';

const columnHelper = createColumnHelper<MonthlyExpenseSummary>();

type ExpenseTableClientProps = {
  calendarYearId: string;
  monthlySummaries: MonthlyExpenseSummary[];
};

export default function ExpenseTableClient({
  calendarYearId,
  monthlySummaries,
}: ExpenseTableClientProps) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

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
              <FaListUl className='h-5 w-5' />
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
      {/* AI Import Button */}
      <div className='mb-4 flex justify-end'>
        <Button variant='default' onClick={() => setIsImportWizardOpen(true)}>
          <FiUpload className='h-4 w-4' />
          AI Import
        </Button>
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
            {table.getRowModel().rows.map((row) => (
              <Table.TBody.TR key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <Table.TBody.TD key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.TBody.TD>
                ))}
              </Table.TBody.TR>
            ))}
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

      {/* AI Import Wizard Modal */}
      <AIImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        calendarYearId={calendarYearId}
        onImportComplete={() => router.refresh()}
      />
    </>
  );
}
