'use client';

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Pencil, Plus, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import MONTHS_MAP from '@/constants/map';
import Table from '@/components/table';
import { tableStyles } from '@/styles/theme';
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

  const initMutation = trpc.bankInterest.initializeBankInterestYear.useMutation({
    onSuccess: () => router.refresh(),
    onError: () => toast.error('Failed to initialise year'),
  });

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
      size: 140,
      header: () => <span>Month</span>,
      cell: (info) => <span className="text-sm text-gray-900 dark:text-gray-100">{MONTHS_MAP.get(info.getValue())}</span>,
    }),
    columnHelper.accessor('receivedFromLedger', {
      size: 140,
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
      size: 160,
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
                    updateMutation.mutate({
                      bankInterestId: bankInterestLiabilityId,
                      bankId,
                      calendarYearId,
                      amount: editingAmount,
                    });
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
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setEditingId(null)}
                className="rounded p-0.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X className="h-3.5 w-3.5" />
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
              className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        );
      },
      footer: () => <span className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">{totalManual === 0 ? '—' : formatCurrency(totalManual)}</span>,
    }),
    columnHelper.accessor('receivedTotal', {
      size: 140,
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
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Interest Credits</h3>
          <p className="text-xs text-muted-foreground">Monthly interest received from the bank</p>
        </div>
        {credits.length === 0 && (
          <button
            type="button"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-primary/10 text-primary hover:bg-primary/20 focus:ring-primary transition-colors"
            onClick={() => initMutation.mutate({ bankId, calendarYearId })}
            disabled={initMutation.isPending}
            aria-label="Start tracking interest for this year"
            title="Start tracking interest for this year"
          >
            {initMutation.isPending
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              : <Plus className="w-4 h-4" />
            }
          </button>
        )}
      </div>

      {credits.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="mb-2 text-muted-foreground/50"><Plus className="h-6 w-6" /></div>
          <p className="mb-1 text-sm font-medium text-foreground">No interest records for this year</p>
          <p className="text-xs text-muted-foreground">Click the + button above to initialise all 12 months</p>
        </div>
      ) : (
        <Table className={tableStyles.container.compact}>
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
  );
}
