'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { toast } from 'sonner';

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

export default function ImportSessionHistory() {
  const { data, refetch, isLoading } = trpc.transactionClearing.listImportSessions.useQuery({
    limit: 20,
  });
  const undoMutation = trpc.transactionClearing.undoImportSession.useMutation({
    onSuccess: (result) => {
      toast.success(`Undone — ${result.voided} transactions reversed`);
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const pendingSession = data?.find((s: SessionRow) => s.id === confirmId);

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Import History</h2>

      {confirmId && pendingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
              Undo Import?
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              This will reverse {pendingSession.transactionCount} transactions and remove their
              financial records.
              <strong className="mt-2 block text-red-600 dark:text-red-400">
                This action cannot be re-done.
              </strong>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  undoMutation.mutate({ importSessionId: confirmId });
                  setConfirmId(null);
                }}
                disabled={undoMutation.isPending}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Yes, Undo Import
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}

      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No imports yet.</p>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Date', 'Type', 'Records', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="cursor-default select-none px-4 py-3 font-medium text-gray-700 dark:text-gray-300"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data as SessionRow[]).map((session) => (
                <tr
                  key={session.id}
                  className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(session.createdAt).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {session.importType === 'EXPENSE' ? 'CSV' : session.importType}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {session.transactionCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(session.status === 'COMPLETED' || session.status === 'PARTIAL') && (
                      <button
                        onClick={() => setConfirmId(session.id)}
                        className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Undo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
