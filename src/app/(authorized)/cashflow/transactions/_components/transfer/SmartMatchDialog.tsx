'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import type { SimilarPairSuggestion } from '@/server/services/transactions/transfer.service';

interface SmartMatchDialogProps {
  open: boolean;
  onClose: () => void;
  sourcePair: {
    debitTransactionId: string;
    creditTransactionId: string;
  };
  onBatchLinked: () => void;
  onSaveRule?: (params: {
    debitTransactionId: string;
    creditTransactionId: string;
    suggestedName: string;
  }) => void;
}

export default function SmartMatchDialog({
  open,
  onClose,
  sourcePair,
  onBatchLinked,
  onSaveRule,
}: SmartMatchDialogProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showSaveRulePrompt, setShowSaveRulePrompt] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const ruleNameInitialisedRef = useRef(false);
  const initializedRef = useRef(false);

  const suggestQuery = trpc.transfer.suggestSimilarPairs.useQuery(
    {
      debitTransactionId: sourcePair.debitTransactionId,
      creditTransactionId: sourcePair.creditTransactionId,
    },
    { enabled: open },
  );

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      ruleNameInitialisedRef.current = false;
      return;
    }
    if (initializedRef.current || !suggestQuery.data) return;
    initializedRef.current = true;
    if (suggestQuery.data.length === 0) {
      // No similar pairs — go straight to Save Rule prompt instead of auto-closing
      if (!ruleNameInitialisedRef.current) {
        ruleNameInitialisedRef.current = true;
        setRuleName(getSuggestedRuleName(suggestQuery.data));
      }
      setShowSaveRulePrompt(true);
      return;
    }
    const preChecked = new Set(
      suggestQuery.data
        .filter((p) => p.confidenceScore >= 85)
        .map((p) => p.debit.transactionId),
    );
    setCheckedIds(preChecked);
  }, [onClose, open, suggestQuery.data]);

  const batchLinkMutation = trpc.transfer.batchLink.useMutation({
    onSuccess: (result) => {
      if (result.linkedCount > 0) {
        toast.success(
          `${result.linkedCount} transfer pair${result.linkedCount > 1 ? 's' : ''} linked`,
        );
        onBatchLinked();
      }
      if (result.errors.length > 0) {
        toast.error(
          `${result.errors.length} pair${result.errors.length > 1 ? 's' : ''} failed to link`,
        );
      }
      if (!ruleNameInitialisedRef.current) {
        ruleNameInitialisedRef.current = true;
        setRuleName(getSuggestedRuleName(suggestQuery.data ?? []));
      }
      setShowSaveRulePrompt(true);
    },
    onError: (err) => toast.error(err.message ?? 'Failed to link pairs'),
  });

  if (!open) return null;

  const pairs = suggestQuery.data ?? [];
  const checkedPairs = pairs.filter((p) => checkedIds.has(p.debit.transactionId));

  function handleToggle(debitId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(debitId)) next.delete(debitId);
      else next.add(debitId);
      return next;
    });
  }

  function handleConfirm() {
    const selectedPairs = pairs
      .filter((p) => checkedIds.has(p.debit.transactionId))
      .map((p) => ({
        debitTransactionId: p.debit.transactionId,
        creditTransactionId: p.credit.transactionId,
      }));
    if (selectedPairs.length === 0) return;
    batchLinkMutation.mutate({ pairs: selectedPairs });
  }

  function handleSaveRule() {
    if (onSaveRule) {
      onSaveRule({
        debitTransactionId: sourcePair.debitTransactionId,
        creditTransactionId: sourcePair.creditTransactionId,
        suggestedName: ruleName,
      });
    }
    onClose();
  }

  const getSuggestedRuleName = (data: typeof pairs) => {
    if (data.length > 0) {
      const words = data[0]!.debit.description
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean)
        .filter(
          (w) =>
            !['to', 'from', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'at', 'on', 'for'].includes(
              w,
            ) && w.length > 1,
        );
      return words[0]
        ? `${words[0].charAt(0).toUpperCase()}${words[0].slice(1)} Transfer`
        : 'Transfer Rule';
    }
    return 'Transfer Rule';
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Smart Match — Similar Pairs
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
          {suggestQuery.isLoading && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Finding similar pairs…
            </p>
          )}
          {!suggestQuery.isLoading &&
            !showSaveRulePrompt &&
            pairs.map((pair) => (
              <PairRow
                key={pair.debit.transactionId}
                pair={pair}
                checked={checkedIds.has(pair.debit.transactionId)}
                onToggle={() => handleToggle(pair.debit.transactionId)}
              />
            ))}
          {showSaveRulePrompt && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-700 dark:bg-teal-900/20">
              <p className="mb-3 text-sm font-medium text-teal-900 dark:text-teal-100">
                Save this pattern as a rule for future imports?
              </p>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Rule name…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <div className="mt-3 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                >
                  Skip
                </button>
                <button
                  onClick={handleSaveRule}
                  className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Save Rule
                </button>
              </div>
            </div>
          )}
        </div>

        {!showSaveRulePrompt && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Skip
            </button>
            <button
              onClick={handleConfirm}
              disabled={checkedPairs.length === 0 || batchLinkMutation.isPending}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {batchLinkMutation.isPending
                ? 'Linking…'
                : `Match Selected (${checkedPairs.length})`} →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function PairRow({
  pair,
  checked,
  onToggle,
}: {
  pair: SimilarPairSuggestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const scoreColor =
    pair.confidenceScore >= 85
      ? 'text-green-600 dark:text-green-400'
      : pair.confidenceScore >= 40
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-gray-500 dark:text-gray-400';

  return (
    <label className="mb-2 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {new Date(pair.debit.date).toLocaleDateString('en-AU')} · {pair.debit.bankAccountName}
          </span>
          <span className={`font-medium ${scoreColor}`}>{pair.confidenceScore}% match</span>
        </div>
        <p className="truncate text-sm text-gray-900 dark:text-white">
          {pair.debit.description} → {pair.credit.description}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ${pair.debit.amount.toFixed(2)} · {pair.dayGap}d gap
        </p>
        {pair.amountDiffWarning && (
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            {pair.amountDiffWarning}
          </p>
        )}
      </div>
    </label>
  );
}
