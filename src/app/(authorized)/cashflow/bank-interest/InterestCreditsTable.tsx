'use client';

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Pencil, Plus, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import MONTHS_MAP from '@/constants/map';
import Table from '@/components/table';
import { trpc } from '@/server/trpc/client';
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

export default function InterestCreditsTable({ credits, bankId, calendarYearId }: InterestCreditsTableProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<number>(0);
  const [collapsed, setCollapsed] = useState(true);

  const updateMutation = trpc.bankInterest.updateBankInterestDetail.useMutation({
    onSuccess: () => {
      setEditingId(null);
      router.refresh();
    },
    onError: () => toast.error('Failed to update amount'),
  });

  const totalFromLedger = credits.reduce((s, m) => s + m.receivedFromLedger, 0);
  const totalManual = credits.reduce((s, m) => s + m.manualOverride, 0);
  const totalReceived = credits.reduce((s, m) => s + m.receivedTotal, 0);

  const columns = [
    columnHelper.accessor('month', {
      header: () => <span>Month</span>,
      cell: (info) => <span className="text-sm text-gray-900 dark:text-gray-100">{MONTHS_MAP.get(info.getValue())}</span>,
    }),
    columnHelper.accessor('receivedFromLedger', {
      header: () => <span>From Ledger</span>,
      cell: ({ getValue }) => (
        <span className={`text-sm tabular-nums ${getValue() === 0 ? 'text-muted-foreground' : 'text-gray-900 dark:text-gray-100'}`}>
          {getValue() === 0 ? '—' : formatCurrency(getValue())}
        </span>
      ),
      footer: () => <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalFromLedger)}</span>,
    }),
    columnHelper.accessor('bankInterestLiabilityId', {
      id: 'manualOverride',
      header: () => <span>Manual Override</span>,
      cell: ({ row }) => {
        const { bankInterestLiabilityId, manualOverride } = row.original;
        const isEditing = editingId === bankInterestLiabilityId;

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={editingAmount}
                onChange={(e) => setEditingAmount(parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateMutation.mutate({ bankInterestId: bankInterestLiabilityId, bankId, calendarYearId, amount: editingAmount });
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-24 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <button
                type="button"
                aria-label="Save"
                onClick={() => updateMutation.mutate({ bankInterestId: bankInterestLiabilityId, bankId, calendarYearId, amount: editingAmount })}
                className="rounded p-0.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setEditingId(null)}
                className="rounded p-0.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        }

        return (
          <div className="group flex items-center gap-1">
            <span className={`text-sm tabular-nums ${manualOverride === 0 ? 'text-muted-foreground' : 'text-blue-700 dark:text-blue-300'}`}>
              {manualOverride === 0 ? '—' : formatCurrency(manualOverride)}
            </span>
            <button
              type="button"
              aria-label="Edit manual override"
              onClick={() => {
                setEditingId(bankInterestLiabilityId);
                setEditingAmount(manualOverride);
              }}
              className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition-[opacity] group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        );
      },
      footer: () => <span className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">{totalManual === 0 ? '—' : formatCurrency(totalManual)}</span>,
    }),
    columnHelper.accessor('receivedTotal', {
      header: () => <span>Total</span>,
      cell: ({ getValue }) => (
        <span className={`text-sm font-medium tabular-nums ${getValue() === 0 ? 'text-muted-foreground' : 'text-gray-900 dark:text-gray-100'}`}>
          {getValue() === 0 ? '—' : formatCurrency(getValue())}
        </span>
      ),
      footer: () => <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalReceived)}</span>,
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
              {totalReceived > 0 ? formatCurrency(totalReceived) + ' received' : 'Reference — monthly amounts from the bank'}
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
