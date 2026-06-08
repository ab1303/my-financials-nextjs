'use client';

import { useEffect, useRef, useState } from 'react';

import {
  REIMBURSEMENT_CATEGORY,
  TRANSFER_CATEGORY,
} from '@/server/services/transactions/constants';
import { trpc } from '@/server/trpc/client';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';

interface UseCategoryEditArgs {
  transaction: LedgerTransactionRow;
  isInReviewBatch: boolean;
  onCategoryChange: (
    id: string,
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,
    applyToMatching?: boolean,
  ) => void;
  /** Called when findSimilar finds ≥2 matches — parent owns the single visible prompt */
  onSuggestRule?: (count: number, category: string) => void;
  /** Called at the start of each handleChange to clear any existing prompt for this row */
  onClearRulePrompt?: () => void;
}

interface UseCategoryEditReturn {
  localCategory: string;
  setLocalCategory: (category: string) => void;
  showRuleDrawer: boolean;
  setShowRuleDrawer: (show: boolean) => void;
  ruleCategory: string;
  handleChange: (
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,
  ) => void;
}

export function useCategoryEdit({
  transaction,
  isInReviewBatch,
  onCategoryChange,
  onSuggestRule,
  onClearRulePrompt,
}: UseCategoryEditArgs): UseCategoryEditReturn {
  const utils = trpc.useUtils();
  const [localCategory, setLocalCategory] = useState(transaction.category);
  const [showRuleDrawer, setShowRuleDrawer] = useState(false);
  const [ruleCategory, setRuleCategory] = useState('');
  const similarCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isInReviewBatchRef = useRef(isInReviewBatch);

  // Keep ref in sync with prop
  useEffect(() => {
    isInReviewBatchRef.current = isInReviewBatch;
    if (isInReviewBatch && similarCheckTimerRef.current) {
      clearTimeout(similarCheckTimerRef.current);
      similarCheckTimerRef.current = null;
    }
  }, [isInReviewBatch]);

  // Sync local category when transaction changes from server
  useEffect(() => {
    setLocalCategory(transaction.category);
  }, [transaction.category]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (similarCheckTimerRef.current) clearTimeout(similarCheckTimerRef.current);
    };
  }, []);

  function handleChange(
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,
  ) {
    setLocalCategory(newCategory);
    onClearRulePrompt?.();
    if (newCategory !== REIMBURSEMENT_CATEGORY) {
      onCategoryChange(
        transaction.id,
        newCategory,
        offsetCategory,
        offsetTransactionId,
        !isInReviewBatch,
      );
      if (
        newCategory !== TRANSFER_CATEGORY &&
        newCategory !== transaction.category &&
        !isInReviewBatch
      ) {
        setRuleCategory(newCategory);
        if (similarCheckTimerRef.current) clearTimeout(similarCheckTimerRef.current);
        similarCheckTimerRef.current = setTimeout(() => {
          if (isInReviewBatchRef.current) return;
          utils.categoryRule.findSimilar
            .fetch({
              description: transaction.description,
              excludeTransactionId: transaction.id,
            })
            .then((result) => {
              if (result.count >= 2 && !isInReviewBatchRef.current) {
                onSuggestRule?.(result.count, newCategory);
              }
            })
            .catch(() => {
              // non-critical
            });
        }, 400);
      }
    }
  }

  return {
    localCategory,
    setLocalCategory,
    showRuleDrawer,
    setShowRuleDrawer,
    ruleCategory,
    handleChange,
  };
}
