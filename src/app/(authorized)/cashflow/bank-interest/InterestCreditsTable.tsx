'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus } from 'lucide-react';

import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';

import type { MonthlyCredit } from './_types';

const columnHelper = createColumnHelper<MonthlyCredit>();

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}

type InterestCreditsTableProps = {
  credits: MonthlyCredit[];
};

export default function InterestCreditsTable({
  credits,
}: InterestCreditsTableProps) {
  const totalFromLedger = credits.reduce((s, m) => s + m.receivedFromLedger, 0);
  const totalCleansed = credits.reduce(
    (s, m) => s + (m.cleansedAmount || 0),
    0,
  );

  const columns = [
    columnHelper.accessor('month', {
      header: () => <span>Month</span>,
      cell: (info) => {
        const name = MONTHS_MAP.get(info.getValue()) || '';
        return (
          <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            {name.charAt(0) + name.slice(1).toLowerCase()}
          </span>
        );
      },
    }),
    columnHelper.accessor('receivedFromLedger', {
      header: () => <span>Interest Received</span>,
      cell: ({ getValue }) => (
        <span
          className={`text-sm tabular-nums ${getValue() === 0 ? 'text-muted-foreground' : 'text-gray-900 dark:text-gray-100'}`}
        >
          {getValue() === 0 ? '—' : formatCurrency(getValue())}
        </span>
      ),
      footer: () => (
        <span className='text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100'>
          {formatCurrency(totalFromLedger)}
        </span>
      ),
    }),
    columnHelper.accessor('cleansedAmount', {
      header: () => <span>Cleansed</span>,
      cell: ({ getValue }) => (
        <span
          className={`text-sm tabular-nums ${getValue() === 0 ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400 font-medium'}`}
        >
          {getValue() === 0 ? '—' : formatCurrency(getValue())}
        </span>
      ),
      footer: () => (
        <span className='text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400'>
          {formatCurrency(totalCleansed)}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'status',
      header: () => <span>Status</span>,
      cell: ({ row }) => {
        const received = row.original.receivedFromLedger;
        const cleansed = row.original.cleansedAmount || 0;

        if (received === 0)
          return <span className='text-[10px] text-gray-400'>No interest</span>;
        if (cleansed >= received - 0.01)
          return (
            <span className='inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-900 dark:text-green-200'>
              Fully Cleansed
            </span>
          );
        if (cleansed > 0)
          return (
            <span className='inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200'>
              Partially Cleansed
            </span>
          );
        return (
          <span className='inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900 dark:text-red-200'>
            Uncleansed
          </span>
        );
      },
    }),
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<MonthlyCredit>({
    data: credits,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className='overflow-auto'>
      {credits.length === 0 ? (
        <div className='flex flex-col items-center py-8 text-center rounded-lg border border-dashed border-border'>
          <Plus
            className='mb-2 h-5 w-5 text-muted-foreground/50'
            aria-hidden='true'
          />
          <p className='mb-1 text-sm font-medium text-foreground'>
            No interest records for this year
          </p>
          <p className='text-xs text-muted-foreground'>
            Select a different calendar year or create interest records in
            settings
          </p>
        </div>
      ) : (
        <Table className='w-full'>
          <Table.THead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.THead.TR key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Table.THead.TH key={header.id}>
                    {flexRender(
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
            {table.getFooterGroups().map((footerGroup) => (
              <Table.TFoot.TR key={footerGroup.id}>
                {footerGroup.headers.map((header) => (
                  <Table.TFoot.TH key={header.id}>
                    {header.column.columnDef.footer
                      ? flexRender(
                          header.column.columnDef.footer,
                          header.getContext(),
                        )
                      : null}
                  </Table.TFoot.TH>
                ))}
              </Table.TFoot.TR>
            ))}
          </Table.TFoot>
        </Table>
      )}
    </div>
  );
}
