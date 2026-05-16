'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface SessionRow {
  id: string;
  importType: string;
  status: string;
  recordsCreated: number;
  transactionCount: number;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    PARTIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    VOIDED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    PENDING: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportSessionHistory({ isOpen, onClose }: Props) {
  const { data, refetch, isLoading } = trpc.transactionClearing.listImportSessions.useQuery(
    { limit: 20 },
    { enabled: isOpen },
  );

  const undoMutation = trpc.transactionClearing.undoImportSession.useMutation({
    onSuccess: (result) => {
      toast.success(`Undone — ${result.voided} transactions reversed`);
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.transactionClearing.deletePendingSession.useMutation({
    onSuccess: () => {
      toast.success('Pending session removed');
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const undoSession = (data as SessionRow[] | undefined)?.find((s) => s.id === undoConfirmId);

  return (
    <>
      <Modal show={isOpen} onClose={onClose} panelClassName="max-w-3xl">
        <Modal.Header>
          <span className="text-xl font-semibold text-foreground">Import History</span>
          <p className="text-sm text-muted-foreground mt-1">
            Recent import sessions. Completed imports can be reversed — this removes all
            associated transactions and financial records.
          </p>
        </Modal.Header>

        <Modal.Body variant="spacious">
          {isLoading && (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          )}

          {!isLoading && (!data || data.length === 0) && (
            <p className="text-sm text-muted-foreground py-4 text-center">No imports yet.</p>
          )}

          {data && data.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {['Date', 'Type', 'Records', 'Status', ''].map((h) => (
                      <th
                        key={h}
                        className="cursor-default select-none px-4 py-3 font-medium text-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data as SessionRow[]).map((session) => (
                    <tr key={session.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(session.createdAt).toLocaleDateString('en-AU')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.importType === 'EXPENSE' ? 'CSV' : session.importType}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.transactionCount}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={session.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(session.status === 'COMPLETED' || session.status === 'PARTIAL') && (
                          <button
                            onClick={() => setUndoConfirmId(session.id)}
                            className="rounded px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                          >
                            Undo
                          </button>
                        )}
                        {session.status === 'PENDING' && (
                          <button
                            onClick={() => setDeleteConfirmId(session.id)}
                            className="rounded px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
      </Modal>

      <ConfirmationDialog
        isOpen={!!undoConfirmId}
        onClose={() => setUndoConfirmId(null)}
        onConfirm={() => {
          if (undoConfirmId) {
            undoMutation.mutate({ importSessionId: undoConfirmId });
            setUndoConfirmId(null);
          }
        }}
        title="Undo Import?"
        message={`This will void all ${undoSession?.transactionCount ?? 0} transactions from this import and reverse their expense summaries and income records. This cannot be re-done.`}
        confirmButtonText="Yes, Undo Import"
        variant="danger"
        isLoading={undoMutation.isPending}
      />

      <ConfirmationDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteMutation.mutate({ importSessionId: deleteConfirmId });
            setDeleteConfirmId(null);
          }
        }}
        title="Delete Pending Session?"
        message="This incomplete import session will be permanently removed. No transactions were created by it."
        confirmButtonText="Delete"
        variant="warning"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
