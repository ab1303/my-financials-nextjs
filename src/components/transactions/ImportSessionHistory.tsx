'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { VoidedTransactionsModal } from '@/components/transactions/VoidedTransactionsModal';
import { AlertTriangle } from 'lucide-react';

interface SessionRow {
  id: string;
  importType: string;
  status: string;
  recordsCreated: number;
  transactionCount: number;
  skippedCount: number; // Phase 1: Add skippedCount
  createdAt: string;
  startDate: string | null;
  endDate:   string | null;
  yearWarning: boolean;
  isLocked: boolean;
}

function formatCoverage(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return '—';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const start = new Date(startDate).toLocaleDateString('en-AU', opts);
  const end   = new Date(endDate).toLocaleDateString('en-AU', opts);
  return start === end ? start : `${start} – ${end}`;
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
      if (result.yearWarning) {
        toast.warning(
          `Undone — ${result.voided} transactions reversed. Note: this import was from a previous fiscal year.`,
        );
      } else {
        toast.success(`Undone — ${result.voided} transactions reversed`);
      }
      setUndoConfirmId(null);
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message);
      setUndoConfirmId(null);
    },
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
  const [voidedModalId, setVoidedModalId] = useState<string | null>(null);

  const undoSession = (data as Array<SessionRow & { yearWarning: boolean }> | undefined)?.find(
    (s) => s.id === undoConfirmId,
  );

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
                    {['Date', 'Type', 'Records', 'Skipped', 'Coverage', 'Status', ''].map((h) => (
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.skippedCount > 0 ? `${session.skippedCount} skipped` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatCoverage(session.startDate, session.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={session.status} />
                        {session.yearWarning && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            <AlertTriangle className="h-3 w-3" /> Prev. year
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(session.status === 'COMPLETED' || session.status === 'PARTIAL') && (
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setVoidedModalId(session.id)}
                              className="rounded px-2 py-1 text-xs font-medium text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50"
                              title="View voided transactions"
                            >
                              Voided
                            </button>
                            {session.isLocked ? (
                              <span
                                className="rounded px-3 py-1 text-xs font-medium text-muted-foreground cursor-not-allowed"
                                title="This fiscal year is locked"
                              >
                                Locked
                              </span>
                            ) : (
                              <button
                                onClick={() => setUndoConfirmId(session.id)}
                                className="rounded px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                              >
                                Undo
                              </button>
                            )}
                          </div>
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
          }
        }}
        title="Undo Import?"
        message={(() => {
          if (!undoSession) return '';
          const txCount = undoSession.transactionCount ?? 0;
          const skipped = undoSession.skippedCount ?? 0;
          const skippedMsg = skipped > 0 ? ` (${skipped} skipped)` : '';
          if (undoSession.yearWarning) {
            return `This import is from a previous fiscal year. Undoing it will reverse ${txCount} transactions${skippedMsg} and remove associated financial records that may have been used for tax reporting. This cannot be re-done.`;
          }
          return `This will void all ${txCount} transactions${skippedMsg} from this import and reverse their expense summaries and income records. This cannot be re-done.`;
        })()}
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

      <VoidedTransactionsModal
        show={!!voidedModalId}
        onClose={() => setVoidedModalId(null)}
        importSessionId={voidedModalId || ''}
        onRestored={() => {
          void refetch();
        }}
      />
    </>
  );
}
