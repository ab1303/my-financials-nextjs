'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import type { TransferLinkDrawerProps } from './_types';
import type { TransferCandidateScore } from '@/server/services/transactions/_types';

export default function TransferLinkDrawer({
  open,
  onClose,
  sourceTransaction,
  onLinked,
}: TransferLinkDrawerProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(manualSearch), 300);
    return () => clearTimeout(t);
  }, [manualSearch]);

  const candidatesQuery = trpc.transfer.getCandidates.useQuery(
    { transactionId: sourceTransaction.id },
    { enabled: open },
  );

  const isAutoEmpty = candidatesQuery.data?.length === 0;

  const searchQuery = trpc.transfer.searchCandidates.useQuery(
    { transactionId: sourceTransaction.id, search: debouncedSearch || undefined },
    { enabled: open && (isAutoEmpty || debouncedSearch.trim().length > 0) },
  );

  const linkMutation = trpc.transfer.link.useMutation({
    onSuccess: (result) => {
      const debitId =
        sourceTransaction.type === 'DEBIT' ? sourceTransaction.id : selectedCandidateId!;
      const creditId =
        sourceTransaction.type === 'CREDIT' ? sourceTransaction.id : selectedCandidateId!;
      const action = result.rollupReversed ? ` — expense rollup reversed` : '';
      toast.success(`Transfer linked successfully${action}`);
      onLinked({ debitTransactionId: debitId, creditTransactionId: creditId });
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? 'Failed to link transfer');
    },
  });

  const selectedCandidate: TransferCandidateScore | undefined =
    candidatesQuery.data?.find((c) => c.transactionId === selectedCandidateId) ??
    searchQuery.data?.find((c) => c.transactionId === selectedCandidateId);

  function handleConfirm() {
    if (!selectedCandidateId) return;

    const debitId =
      sourceTransaction.type === 'DEBIT' ? sourceTransaction.id : selectedCandidateId;
    const creditId =
      sourceTransaction.type === 'CREDIT' ? sourceTransaction.id : selectedCandidateId;

    linkMutation.mutate({ debitTransactionId: debitId, creditTransactionId: creditId });
  }

  if (!open) return null;

  const drawerContent = (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="relative z-10 w-full max-w-2xl rounded-t-2xl bg-white shadow-xl dark:bg-gray-900 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Link as Transfer</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {sourceTransaction.description} · ${sourceTransaction.amount.toFixed(2)} ·{' '}
              {sourceTransaction.bankAccountName ?? 'Unknown account'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close drawer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {candidatesQuery.isLoading && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Finding matching transactions…
            </p>
          )}

          {candidatesQuery.isError && (
            <p className="text-center text-sm text-red-500">
              Failed to load candidates. Please try again.
            </p>
          )}

          {/* Auto-candidates */}
          {candidatesQuery.data && candidatesQuery.data.length > 0 && !debouncedSearch && (
            <ul className="space-y-2">
              {candidatesQuery.data.map((candidate) => (
                <CandidateRow
                  key={candidate.transactionId}
                  candidate={candidate}
                  isSelected={selectedCandidateId === candidate.transactionId}
                  onSelect={() =>
                    setSelectedCandidateId(
                      selectedCandidateId === candidate.transactionId ? null : candidate.transactionId,
                    )
                  }
                />
              ))}
            </ul>
          )}

          {/* Manual search — shown when auto returns nothing, or user types */}
          {(isAutoEmpty || debouncedSearch.trim().length > 0) && (
            <div className="mt-2 space-y-3">
              {isAutoEmpty && !debouncedSearch && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  No candidates found within 5 days. Search below to find the counterpart manually.
                </p>
              )}
              <input
                type="text"
                value={manualSearch}
                onChange={(e) => {
                  setManualSearch(e.target.value);
                  setSelectedCandidateId(null);
                }}
                placeholder="Search by description…"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              />
              {searchQuery.isLoading && (
                <p className="text-center text-sm text-gray-400">Searching…</p>
              )}
              {searchQuery.data && searchQuery.data.length === 0 && (
                <p className="text-center text-sm text-gray-400">No matching transactions found.</p>
              )}
              {searchQuery.data && searchQuery.data.length > 0 && (
                <ul className="space-y-2">
                  {searchQuery.data.map((candidate) => (
                    <CandidateRow
                      key={candidate.transactionId}
                      candidate={candidate}
                      isSelected={selectedCandidateId === candidate.transactionId}
                      onSelect={() =>
                        setSelectedCandidateId(
                          selectedCandidateId === candidate.transactionId ? null : candidate.transactionId,
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Amount diff warning */}
        {selectedCandidate?.amountDiffWarning && (
          <div className="mx-6 mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>{selectedCandidate.amountDiffWarning}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCandidateId || linkMutation.isPending}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            {linkMutation.isPending ? 'Linking…' : 'Confirm Link'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}

function CandidateRow({
  candidate,
  isSelected,
  onSelect,
}: {
  candidate: TransferCandidateScore;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const scoreColor =
    candidate.confidenceScore >= 70
      ? 'text-green-600 dark:text-green-400'
      : candidate.confidenceScore >= 40
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-gray-500 dark:text-gray-400';

  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
          isSelected
            ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-900/20'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {candidate.bankAccountName}
              {candidate.bankName && (
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  ({candidate.bankName})
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {new Date(candidate.date).toLocaleDateString('en-AU')} · {candidate.description}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              ${candidate.amount.toFixed(2)}
            </p>
            <p className={`text-xs font-medium ${scoreColor}`}>
              {candidate.confidenceScore}% match
            </p>
          </div>
        </div>
      </button>
    </li>
  );
}
