'use client';

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import MONTHS_MAP from '@/constants/map';
import Table from '@/components/table';
import { tableStyles } from '@/styles/theme';
import { trpc } from '@/server/trpc/client';

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

type DrawerRow = {
  liabilityId: string;
  receivedTotal: number;
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
  const [drawerRow, setDrawerRow] = useState<DrawerRow | null>(null);
  const { state: { data }, dispatch } = useBankInterestState();
  const router = useRouter();

  const initMutation = trpc.bankInterest.initializeBankInterestYear.useMutation({
    onSuccess: () => router.refresh(),
  });

  const openDrawer = (row: BankInterestType) => {
    setDrawerRow({ liabilityId: row.bankInterestLiabilityId, receivedTotal: row.receivedTotal });
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
        if (status === 'CLEANSED' || status === 'MANUAL') return null;
        const isNone = status === 'NONE';
        return (
          <button
            type="button"
            onClick={() => openDrawer(row.original)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium text-white ${
              isNone
                ? 'bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500'
                : 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600'
            }`}
          >
            {isNone ? 'Record' : 'Cleanse'}
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
      <UnlinkedInterestBanner unlinkedCount={unlinkedCount} onCleanse={() => {
        const firstPending = data.find((r) => r.status === 'PENDING' || r.status === 'PARTIAL');
        if (firstPending) openDrawer(firstPending);
      }} />

      {drawerRow && (
        <CleanseDonationDrawer
          isOpen={!!drawerRow}
          onClose={() => setDrawerRow(null)}
          bankId={bankId}
          calendarYearId={calendarYearId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          liabilityId={drawerRow.liabilityId}
          receivedTotal={drawerRow.receivedTotal}
          onDonationSaved={(bankInterestLiabilityId, amountAdded, hasTransactionLink) => {
            dispatch({
              type: 'BANK_INTEREST/ADD_CLEANSING_DONATION',
              payload: { bankInterestLiabilityId, amountAdded, hasTransactionLink },
            });
          }}
        />
      )}

      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-medium text-foreground'>Monthly Records</h3>
        {data.length === 0 && (
          <button
            type='button'
            className='inline-flex items-center justify-center w-10 h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-primary/10 text-primary hover:bg-primary/20 focus:ring-primary transition-colors'
            onClick={() => initMutation.mutate({ bankId, calendarYearId })}
            disabled={initMutation.isPending}
            aria-label='Start tracking interest for this year'
            title='Start tracking interest for this year'
          >
            {initMutation.isPending
              ? <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
              : <Plus className='w-4 h-4' />
            }
          </button>
        )}
      </div>

      {data.length === 0 ? (
        <div className='flex flex-col items-center py-12 text-center'>
          <div className='mb-2 text-muted-foreground/50'>
            <Plus className='h-6 w-6' />
          </div>
          <p className='mb-1 text-base font-medium text-foreground'>
            No interest records for this year
          </p>
          <p className='text-sm text-muted-foreground'>
            Click the + button above to initialise all 12 months for this year
          </p>
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
      )}
    </>
  );
}
