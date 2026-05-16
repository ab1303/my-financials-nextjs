'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';
import { MdOutlineCancel } from 'react-icons/md';

interface Props {
  transactionId: string;
  onVoided: () => void;
}

export default function VoidTransactionButton({ transactionId, onVoided }: Props) {
  const [open, setOpen] = useState(false);

  const mutation = trpc.transactionClearing.voidTransaction.useMutation({
    onSuccess: () => {
      toast.success('Transaction voided');
      setOpen(false);
      onVoided();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <button
        aria-label="Void transaction"
        onClick={() => setOpen(true)}
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      >
        <MdOutlineCancel size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800">
            <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
              Void this transaction? Its financial records will be reversed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate({ transactionId })}
                disabled={mutation.isPending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Void
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
