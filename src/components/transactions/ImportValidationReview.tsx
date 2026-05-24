'use client';

import React, { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { trpc } from '@/server/trpc/client';

export interface ImportValidationReviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sessionId: string;
  isLoading: boolean;
}

type TransactionStatus = 'IMPORTED' | 'VOIDED' | 'PENDING' | 'CONFIRMED' | 'EXCLUDED';

interface ImportSessionTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
}

interface ImportSessionDetails {
  id: string;
  userId: string;
  importType: string;
  status: string;
  recordsCreated: number;
  skippedCount: number;
  metadata?: any;
  startDate?: string;
  endDate?: string;
  transactions: ImportSessionTransaction[];
}

export const ImportValidationReview: React.FC<ImportValidationReviewProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sessionId,
  isLoading,
}) => {
  // Fetch import session details
  const { data, isLoading: isFetching, isError, error, refetch } = trpc.transactionClearing.getImportSessionDetails.useQuery(
    { sessionId },
    {
      enabled: isOpen && !!sessionId,
      staleTime: 60_000,
    },
  );

  // Memoize stats
  const { toBeVoided, alreadyVoided } = useMemo(() => {
    const txs = data?.transactions || [];
    return {
      toBeVoided: txs.filter((t) => t.status !== 'VOIDED').length,
      alreadyVoided: txs.filter((t) => t.status === 'VOIDED').length,
    };
  }, [data]);

  // Table row styling for VOIDED
  const getRowClass = (status: string) =>
    status === 'VOIDED'
      ? 'bg-gray-100 text-gray-400 line-through dark:bg-gray-800 dark:text-gray-500'
      : '';

  // Format date (YYYY-MM-DD)
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-AU');
    } catch {
      return iso;
    }
  };

  // Format amount
  const formatAmount = (amtStr: string) => {
    try {
      const amt = parseFloat(amtStr);
      return amt.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
    } catch {
      return amtStr;
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} panelClassName="max-w-2xl">
      <Modal.Header>
        <span className="text-lg font-semibold text-foreground">Review Import Undo</span>
        <p className="text-sm text-muted-foreground mt-1">
          Review the transactions that will be voided. This action cannot be undone.
        </p>
      </Modal.Header>

      <Modal.Body variant="spacious">
        {(isFetching || !data) && !isError ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-muted-foreground">Loading import details…</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <span className="text-red-600 dark:text-red-400">Failed to load import details.</span>
            <button
              className="px-3 py-1 rounded text-xs font-medium bg-muted hover:bg-muted/80 text-foreground"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Summary stats */}
            <div className="mb-4 p-3 bg-muted rounded space-y-1">
              <div className="text-sm text-foreground">
                <span className="font-semibold">{toBeVoided}</span> transaction{toBeVoided !== 1 ? 's' : ''} will be voided
              </div>
              {data.skippedCount > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold">{data.skippedCount}</span> transaction{data.skippedCount !== 1 ? 's' : ''} were skipped during import
                </div>
              )}
              {alreadyVoided > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold">{alreadyVoided}</span> transaction{alreadyVoided !== 1 ? 's are' : ' is'} already VOIDED
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-foreground">Amount</th>
                    <th className="px-4 py-3 text-center font-medium text-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.transactions.map((tx) => (
                    <tr key={tx.id} className={getRowClass(tx.status) + ' hover:bg-muted/50'}>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(tx.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{tx.description}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatAmount(tx.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        {tx.status === 'VOIDED' ? (
                          <span className="inline-block text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 font-medium">
                            VOIDED
                          </span>
                        ) : (
                          <span className="inline-block text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                            IMPORTED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          className="px-4 py-2 rounded text-sm font-medium bg-muted text-foreground hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={onClose}
          disabled={isLoading || isFetching}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={onConfirm}
          disabled={isLoading || isFetching || isError}
        >
          {isLoading ? 'Undoing…' : 'Confirm Undo'}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default ImportValidationReview;
