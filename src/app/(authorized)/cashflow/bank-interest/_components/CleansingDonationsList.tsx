'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import CleanseDonationDrawer from './CleanseDonationDrawer';
import type { CleansingDonation, YearlySummary } from '../_types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type CleansingDonationsListProps = {
  donations: CleansingDonation[];
  yearlySummary: YearlySummary;
  bankId: string;
  calendarYearId: string;
  dateFrom: string;
  dateTo: string;
  unlinkedInterestCount: number;
};

export default function CleansingDonationsList({
  donations,
  yearlySummary,
  bankId,
  calendarYearId,
  dateFrom,
  dateTo,
  unlinkedInterestCount,
}: CleansingDonationsListProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
      {unlinkedInterestCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            🔗 <strong>{unlinkedInterestCount}</strong> bank interest transaction
            {unlinkedInterestCount !== 1 ? 's' : ''} available to link.
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            Cleanse Now
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Cleansing Donations</h3>
          <p className="text-xs text-muted-foreground">All donations paid to cleanse interest this year</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Year total: {formatCurrency(yearlySummary.totalReceived)} received · {formatCurrency(yearlySummary.totalCleansed)} cleansed · {formatCurrency(yearlySummary.balance)} remaining
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-primary/10 text-primary hover:bg-primary/20 focus:ring-primary transition-colors"
          aria-label="Add cleansing donation"
          title="Add cleansing donation"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {donations.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center border border-dashed border-border rounded-lg">
          <div className="mb-2 text-muted-foreground/50"><Plus className="h-6 w-6" aria-hidden="true" /></div>
          <p className="mb-1 text-sm font-medium text-foreground">No cleansing donations recorded</p>
          <p className="text-xs text-muted-foreground">Click + to record your first cleansing donation for this year</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="select-none cursor-default px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="select-none cursor-default px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                <th className="select-none cursor-default px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Beneficiary</th>
                <th className="select-none cursor-default px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((donation) => (
                <tr key={donation.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(donation.datePaid)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(donation.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {donation.beneficiaryName}
                  </td>
                  <td className="px-4 py-3">
                    {donation.source === 'LINKED' ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Manual
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CleanseDonationDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          router.refresh();
        }}
        bankId={bankId}
        calendarYearId={calendarYearId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDonationSaved={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
