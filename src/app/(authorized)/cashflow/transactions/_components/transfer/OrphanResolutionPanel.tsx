'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { trpc } from '@/server/trpc/client';

interface OrphanResolutionPanelProps {
  onResolved?: () => void;
}

export default function OrphanResolutionPanel({ onResolved }: OrphanResolutionPanelProps) {
  const utils = trpc.useUtils();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data: orphans = [], isLoading } = trpc.transfer.getOrphanedTransfers.useQuery({});

  const resolveMutation = trpc.transfer.resolveOrphan.useMutation({
    onSuccess: () => {
      setResolvingId(null);
      void utils.transfer.getOrphanedTransfers.invalidate();
      onResolved?.();
      toast.success('Orphaned transfer resolved');
    },
    onError: (err) => {
      setResolvingId(null);
      toast.error(err.message);
    },
  });

  if (isLoading) return null;
  if (orphans.length === 0) return null;

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatAmount = (amount: number | string) =>
    `$${Math.abs(Number(amount)).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className='mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30'>
      <div className='flex items-start gap-3'>
        <AlertTriangle className='mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500' />
        <div className='flex-1 min-w-0'>
          <h3 className='font-medium text-amber-800 dark:text-amber-200'>
            {orphans.length} orphaned transfer{orphans.length !== 1 ? 's' : ''} need resolution
          </h3>
          <p className='mt-0.5 text-sm text-amber-700 dark:text-amber-300'>
            These transfers have no matching counterpart after 30 days. Classify each one so it&apos;s correctly included in your reports.
          </p>

          <div className='mt-4 space-y-3'>
            {(orphans as any[]).map((orphan) => (
              <div
                key={orphan.id}
                className='rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-700 dark:bg-gray-900'
              >
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium text-gray-900 truncate dark:text-white'>
                      {orphan.description}
                    </p>
                    <p className='mt-0.5 text-xs text-gray-500 dark:text-gray-400'>
                      {formatDate(orphan.date)} · {formatAmount(orphan.amount)} ·{' '}
                      {(orphan.financialAccount as any)?.name ?? 'Unknown account'}
                    </p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <button
                      type='button'
                      disabled={resolvingId === orphan.id}
                      onClick={() => {
                        setResolvingId(orphan.id);
                        resolveMutation.mutate({
                          transactionId: orphan.id,
                          resolution: 'EXPENSE',
                          newCategory: 'Other',
                        });
                      }}
                      className='rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50'
                    >
                      Real expense
                    </button>
                    <button
                      type='button'
                      disabled={resolvingId === orphan.id}
                      onClick={() => {
                        setResolvingId(orphan.id);
                        resolveMutation.mutate({
                          transactionId: orphan.id,
                          resolution: 'INCOME',
                          newCategory: 'Other Income',
                        });
                      }}
                      className='rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                    >
                      Real income
                    </button>
                    <button
                      type='button'
                      disabled={resolvingId === orphan.id}
                      onClick={() => {
                        setResolvingId(orphan.id);
                        resolveMutation.mutate({
                          transactionId: orphan.id,
                          resolution: 'EXCLUDED',
                        });
                      }}
                      className='rounded-md bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    >
                      Exclude (single-sided)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
