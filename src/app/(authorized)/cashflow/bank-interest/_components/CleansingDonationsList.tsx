'use client';

import { useState } from 'react';
import { Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import CleanseDonationDrawer from './CleanseDonationDrawer';
import type { CleansingDonation, YearlySummary } from '../_types';
import { trpc } from '@/server/trpc/client';
import { Badge } from '@/components/ui/badge';

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
  const removeMutation = trpc.bankInterest.removeAllocation.useMutation({
    onSuccess: () => {
      toast.success('Allocation removed');
      router.refresh();
    }
  });

  const handleRemoveAllocation = async (allocationId: string) => {
    if (confirm('Are you sure you want to remove this evidence allocation?')) {
      await removeMutation.mutateAsync({ allocationId });
    }
  };

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
        <div className="overflow-hidden rounded-lg border border-border bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="select-none cursor-default px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Donation Details</th>
                  <th className="select-none cursor-default px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="select-none cursor-default px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence / Allocation</th>
                  <th className="select-none cursor-default px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {donations.map((donation) => (
                  <tr key={donation.id} className="hover:bg-muted/10 align-top">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{donation.beneficiaryName}</p>
                      <p className="text-xs text-gray-500">{formatDate(donation.datePaid)}</p>
                      {donation.interestTxDescription && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                           <LinkIcon size={10} />
                           <span className="truncate max-w-[150px]" title={donation.interestTxDescription}>{donation.interestTxDescription}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(donation.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {donation.evidence && donation.evidence.length > 0 ? (
                        <div className="space-y-2">
                          {donation.evidence.map((ev) => (
                            <div key={ev.id} className="group flex items-center justify-between rounded-md bg-gray-50/50 p-2 dark:bg-gray-800/30">
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-medium text-gray-700 dark:text-gray-300" title={ev.description}>{ev.description}</p>
                                <div className="flex gap-2 text-[10px] text-gray-500">
                                   <span>{formatDate(ev.date)}</span>
                                   <span className="font-semibold text-blue-600 dark:text-blue-400">Allocated: {formatCurrency(ev.amountApplied)}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleRemoveAllocation(ev.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                title="Remove allocation"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No evidence transactions linked</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {donation.source === 'LINKED' ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200">
                          Linked M:N
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 border-slate-200 dark:text-slate-400 dark:border-slate-800">
                          Manual
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CleanseDonationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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
