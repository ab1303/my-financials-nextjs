'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';

export interface VoidedTransactionsModalProps {
  show: boolean;
  onClose: () => void;
  importSessionId: string;
  onRestored?: () => void;
}

export function VoidedTransactionsModal({
  show,
  onClose,
  importSessionId,
  onRestored,
}: VoidedTransactionsModalProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = trpc.transactionLedger.getVoidedTransactions.useQuery(
    { importSessionId, limit: 100 },
    { enabled: show },
  );

  const restoreMutation = trpc.transactionLedger.restoreVoidedTransaction.useMutation({
    onSuccess: () => {
      toast.success('Transaction restored');
      setRestoringId(null);
      void refetch();
      onRestored?.();
    },
    onError: (err) => {
      toast.error(err.message);
      setRestoringId(null);
    },
  });

  const handleRestore = (transactionId: string) => {
    setRestoringId(transactionId);
    restoreMutation.mutate({ transactionId });
  };

  return (
    <Modal show={show} onClose={onClose}>
      <Modal.Header>Voided Transactions</Modal.Header>
      <Modal.Body>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading voided transactions...</p>
          </div>
        ) : error ? (
          <div className="rounded bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            Failed to load voided transactions
          </div>
        ) : !data?.transactions.length ? (
          <div className="rounded bg-blue-50 p-4 text-sm text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            No voided transactions from this import
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''} voided.
              Click "Restore" to bring them back into the ledger.
            </p>
            <div className="max-h-96 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="select-none cursor-default px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Date
                    </th>
                    <th className="select-none cursor-default px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </th>
                    <th className="select-none cursor-default px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                      Amount
                    </th>
                    <th className="select-none cursor-default px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{tx.description}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                        {tx.type === 'DEBIT' ? '-' : '+'}${tx.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleRestore(tx.id)}
                          disabled={restoringId === tx.id || restoreMutation.isPending}
                          className="rounded px-3 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-400 dark:hover:bg-teal-900/30"
                        >
                          {restoringId === tx.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
