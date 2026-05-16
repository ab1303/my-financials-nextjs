'use client';

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useState } from 'react';

import MONTHS_MAP from '@/constants/map';
import Table from '@/components/table';
import { tableStyles } from '@/styles/theme';

import CleanseDonationDrawer from './_components/CleanseDonationDrawer';
import UnlinkedInterestBanner from './_components/UnlinkedInterestBanner';
import { useBankInterestState } from './StateProvider';
import type { BankInterestType, CleansingStatus, YearlySummary } from './_types';

const columnHelper = createColumnHelper<BankInterestType>();

const STATUS_CONFIG: Record<CleansingStatus, { label: string; className: string }> = {
  CLEANSED: { label: '✓ Cleansed', className: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  MANUAL: { label: '📝 Manual', className: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  PARTIAL: { label: '◑ Partial', className: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  PENDING: { label: '⚠ Pending', className: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  NONE: { label: '—', className: 'text-xs text-muted-foreground dark:text-muted-foreground' },
};

type BankInterestTableClientProps = {
  bankId: string;
  calendarYearId: string;
  unlinkedCount: number;
  yearlySummary: YearlySummary;
  dateFrom: string;
  dateTo: string;
  onOpenDrawer?: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

export default function BankInterestTableClient({
  bankId,
  calendarYearId,
  unlinkedCount,
  yearlySummary,
  dateFrom,
  dateTo,
  onOpenDrawer,
}: BankInterestTableClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { state: { data }, dispatch } = useBankInterestState();

  const openDrawer = () => {
    setDrawerOpen(true);
    onOpenDrawer?.();
  };

  const columns = [
    columnHelper.accessor('month', {
      size: 100,
      header: () => <span>Month</span>,
      cell: (info) => MONTHS_MAP.get(info.getValue()),
    }),
    columnHelper.accessor('receivedFromLedger', {
      size: 140,
      header: () => <span>From Ledger</span>,
      cell: ({ getValue }) => <span className="text-sm tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(getValue())}</span>,
    }),
    columnHelper.accessor('manualOverride', {
      size: 140,
      header: () => <span>Manual Override</span>,
      cell: ({ getValue }) => <span className="text-sm tabular-nums text-muted-foreground dark:text-muted-foreground">{formatCurrency(getValue())}</span>,
    }),
    columnHelper.accessor('receivedTotal', {
      size: 140,
      header: () => <span>Total Received</span>,
      cell: ({ getValue }) => <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(getValue())}</span>,
      footer: () => <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(yearlySummary.totalReceived)}</span>,
    }),
    columnHelper.accessor('amountCleansed', {
      size: 140,
      header: () => <span>Cleansed</span>,
      cell: ({ getValue }) => <span className="text-sm tabular-nums text-green-700 dark:text-green-400">{formatCurrency(getValue())}</span>,
      footer: () => <span className="text-sm font-semibold tabular-nums text-green-700 dark:text-green-400">{formatCurrency(yearlySummary.totalCleansed)}</span>,
    }),
    columnHelper.accessor('balance', {
      size: 120,
      header: () => <span>Balance</span>,
      cell: ({ getValue }) => {
        const value = getValue();
        return <span className={`text-sm tabular-nums font-medium ${value > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground dark:text-muted-foreground'}`}>{formatCurrency(value)}</span>;
      },
      footer: () => {
        const remaining = yearlySummary.remaining;
        return <span className={`text-sm font-semibold tabular-nums ${remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground dark:text-muted-foreground'}`}>{formatCurrency(remaining)}</span>;
      },
    }),
    columnHelper.accessor('status', {
      size: 120,
      header: () => <span>Status</span>,
      cell: ({ getValue }) => {
        const config = STATUS_CONFIG[getValue()];
        return <span className={config.className}>{config.label}</span>;
      },
    }),
    columnHelper.display({
      id: 'action',
      size: 120,
      header: () => <span>Action</span>,
      cell: ({ row }) => {
        const { status } = row.original;
        if (status === 'NONE' || status === 'CLEANSED' || status === 'MANUAL') return null;
        return (
          <button
            type="button"
            onClick={openDrawer}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            Cleanse
          </button>
        );
      },
    }),
  ];

  const table = useReactTable<BankInterestType>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <UnlinkedInterestBanner unlinkedCount={unlinkedCount} onCleanse={openDrawer} />

      {drawerOpen && (
        <CleanseDonationDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bankId={bankId}
          calendarYearId={calendarYearId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDonationSaved={(bankInterestLiabilityId, amountAdded, hasTransactionLink) => {
            dispatch({
              type: 'BANK_INTEREST/ADD_CLEANSING_DONATION',
              payload: { bankInterestLiabilityId, amountAdded, hasTransactionLink },
            });
          }}
        />
      )}

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
          {!!data.length && table.getFooterGroups().map((footerGroup) => (
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
    </>
  );
}
