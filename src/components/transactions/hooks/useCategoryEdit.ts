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
  isInReviewBatch?: boolean;
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
  findMatches: () => Promise<number>;
  matchCount: number;
}

export function useCategoryEdit({
  transaction,
  onCategoryChange,
  onClearRulePrompt,
}: UseCategoryEditArgs): UseCategoryEditReturn {
  const utils = trpc.useUtils();
  const [localCategory, setLocalCategory] = useState(transaction.category);
  const [showRuleDrawer, setShowRuleDrawer] = useState(false);
  const [ruleCategory, setRuleCategory] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  // Sync local category when transaction changes from server
  useEffect(() => {
    setLocalCategory(transaction.category);
  }, [transaction.category]);

  async function findMatches() {
    const result = await utils.categoryRule.findSimilar.fetch({
      description: transaction.description,
      excludeTransactionId: transaction.id,
    });
    setMatchCount(result.count);
    return result.count;
  }

  function handleChange(
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,
  ) {
    setLocalCategory(newCategory);
    onClearRulePrompt?.();
    
    // Explicitly set applyToMatching: false here.
    // The UI will now use a separate call to onCategoryChange for bulk actions.
    onCategoryChange(
      transaction.id,
      newCategory,
      offsetCategory,
      offsetTransactionId,
      false,
    );
    
    setRuleCategory(newCategory);
    // Trigger match check eagerly but silently
    findMatches();
  }

  return {
    localCategory,
    setLocalCategory,
    showRuleDrawer,
    setShowRuleDrawer,
    ruleCategory,
    handleChange,
    findMatches,
    matchCount,
  };
}
