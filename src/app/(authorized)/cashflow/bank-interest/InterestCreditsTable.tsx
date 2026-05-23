'use client';

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';

import MONTHS_MAP from '@/constants/map';
import Table from '@/components/table';
import type { MonthlyCredit } from './_types';

const columnHelper = createColumnHelper<MonthlyCredit>();

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

type InterestCreditsTableProps = {
  credits: MonthlyCredit[];
  bankId: string;
  calendarYearId: string;
};

export default function InterestCreditsTable({ credits }: InterestCreditsTableProps) {
  const [collapsed, setCollapsed] = useState(true);

  const totalFromLedger = credits.reduce((s, m) => s + m.receivedFromLedger, 0);

  const columns = [
    columnHelper.accessor('month', {
      header: () => <span>Month</span>,
      cell: (info) => <span className="text-sm text-gray-900 dark:text-gray-100">{MONTHS_MAP.get(info.getValue())}</span>,
    }),
    columnHelper.accessor('receivedFromLedger', {
      header: () => <span>Interest Received</span>,
      cell: ({ getValue }) => (
        <span className={`text-sm font-medium tabular-nums ${getValue() === 0 ? 'text-muted-foreground' : 'text-gray-900 dark:text-gray-100'}`}>
          {getValue() === 0 ? '—' : formatCurrency(getValue())}
        </span>
      ),
      footer: () => <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalFromLedger)}</span>,
    }),
  ];

  const table = useReactTable<MonthlyCredit>({
    data: credits,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      {/* Collapsible header */}
      <div className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center gap-3 text-left hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity"
          aria-expanded={!collapsed}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          }
          <div>
            <span className="text-sm font-medium text-foreground">Interest Credits</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {totalFromLedger > 0 ? formatCurrency(totalFromLedger) + ' received' : 'Reference — monthly amounts from the bank'}
            </span>
          </div>
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2">
          {credits.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center rounded-lg border border-dashed border-border">
              <Plus className="mb-2 h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
              <p className="mb-1 text-sm font-medium text-foreground">No interest records for this year</p>
              <p className="text-xs text-muted-foreground">Select a different calendar year or create interest records in settings</p>
            </div>
          ) : (
            <Table className="w-full">
              <Table.THead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Table.THead.TR key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <Table.THead.TH key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
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
                        {header.column.columnDef.footer ? flexRender(header.column.columnDef.footer, header.getContext()) : null}
                      </Table.TFoot.TH>
                    ))}
                  </Table.TFoot.TR>
                ))}
              </Table.TFoot>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
