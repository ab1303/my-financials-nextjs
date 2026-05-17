'use client';

import { PiLinkBreak } from 'react-icons/pi';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';

interface UnlinkTransferButtonProps {
  transactionId: string;
  onUnlinked: () => void;
}

export function UnlinkTransferButton({
  transactionId,
  onUnlinked,
}: UnlinkTransferButtonProps) {
  const unlinkMutation = trpc.transfer.unlink.useMutation({
    onSuccess: () => {
      toast.success('Transfer unlinked');
      onUnlinked();
    },
    onError: (err) => toast.error(err.message ?? 'Failed to unlink transfer'),
  });

  return (
    <button
      type="button"
      aria-label="Unlink transfer"
      title="Unlink transfer"
      disabled={unlinkMutation.isPending}
      onClick={() => unlinkMutation.mutate({ transactionId })}
      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 disabled:opacity-50"
    >
      <PiLinkBreak className="h-4 w-4" />
    </button>
  );
}
