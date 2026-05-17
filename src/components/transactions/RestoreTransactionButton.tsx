'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';

interface Props {
  transactionId: string;
  onRestored: () => void;
}

export default function RestoreTransactionButton({ transactionId, onRestored }: Props) {
  const [open, setOpen] = useState(false);

  const mutation = trpc.transactionClearing.restoreTransaction.useMutation({
    onSuccess: () => {
      toast.success('Transaction restored');
      setOpen(false);
      onRestored();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <button
        type="button"
        aria-label="Restore transaction"
        title="Restore transaction"
        onClick={() => setOpen(true)}
        className="rounded p-1 text-gray-400 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-900/20 dark:hover:text-teal-400"
      >
        <RotateCcw size={15} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800">
            <p className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-100">
              Restore this transaction?
            </p>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              It will be returned to its previous status and any financial records it had will be
              re-applied.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate({ transactionId })}
                disabled={mutation.isPending}
                className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
