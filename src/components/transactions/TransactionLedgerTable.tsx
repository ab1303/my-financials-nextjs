'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import LinkTransactionsDrawer from '@/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer';
import OrphanResolutionPanel from '@/app/(authorized)/cashflow/transactions/_components/transfer/OrphanResolutionPanel';
import SmartMatchDialog from '@/app/(authorized)/cashflow/transactions/_components/transfer/SmartMatchDialog';
import TransferLinkDrawer from '@/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer';
import UnmatchedTransfersBadge from '@/app/(authorized)/cashflow/transactions/_components/transfer/UnmatchedTransfersBadge';
import LinkZakatTransactionsDrawer from '@/app/(authorized)/zakat/_components/LinkZakatTransactionsDrawer';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { REIMBURSEMENT_CATEGORY, TRANSFER_CATEGORY } from '@/server/services/transactions/constants';
import { trpc } from '@/server/trpc/client';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';

import TransactionFilters, { type DatePreset,getPresetDateRange } from './TransactionFilters';
import TransactionRow from './TransactionRow';
import TransactionSummary from './TransactionSummary';

type TabFilter = 'all' | 'expenses' | 'income' | 'excluded' | 'reimbursements' | 'uncategorized' | 'voided' | 'transfers';

type GetAllInput = {
  cursor?: string;
  limit: number;
  type?: 'DEBIT' | 'CREDIT';
  status?: 'PENDING' | 'CONFIRMED' | 'EXCLUDED' | 'VOIDED';
  bankAccountId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  uncategorized?: boolean;
  reimbursementOnly?: boolean;
  amountMin?: number;
  amountMax?: number;
  transferOnly?: boolean;
  unmatchedTransferOnly?: boolean;
  excludeTransferCategory?: boolean;
  ids?: string[]; // review mode: fetch exactly these transaction IDs
};

interface TransactionLedgerTableProps {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  refreshKey?: number;
  initialMonth?: number;
  initialYear?: number;
  initialCategory?: string;
  initialTab?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}

const PAGE_SIZE = 50;

const TAB_TO_PARAMS: Record<TabFilter, Partial<Pick<GetAllInput, 'type' | 'status' | 'reimbursementOnly' | 'transferOnly' | 'excludeTransferCategory'>>> = {
  all: {},
  expenses: { type: 'DEBIT', status: 'CONFIRMED', excludeTransferCategory: true },
  income: { type: 'CREDIT', status: 'CONFIRMED', excludeTransferCategory: true },
  excluded: { status: 'EXCLUDED', excludeTransferCategory: true },
  reimbursements: { reimbursementOnly: true },
  uncategorized: {},
  voided: { status: 'VOIDED' },
  transfers: { transferOnly: true },
};

const TAB_INFO: Partial<Record<TabFilter, string>> = {
  excluded:
    'Transactions intentionally excluded from financial records — e.g. transfers between your own accounts that would otherwise be double-counted.',
  uncategorized:
    'Imported transactions that have not been assigned a category yet. Review and categorise these to keep your reports accurate.',
  voided:
    'Transactions whose financial impact has been fully reversed and removed from reports. Voided transactions cannot be edited.',
};

function parseAmount(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function TransactionLedgerTable({
  bankAccounts,
  refreshKey,
  initialMonth,
  initialYear,
  initialCategory,
  initialTab,
  initialDateFrom,
  initialDateTo,
}: TransactionLedgerTableProps) {
  return (
    <TransactionLedgerBody
      bankAccounts={bankAccounts}
      refreshKey={refreshKey}
      initialMonth={initialMonth}
      initialYear={initialYear}
      initialCategory={initialCategory}
      initialTab={initialTab}
      initialDateFrom={initialDateFrom}
      initialDateTo={initialDateTo}
    />
  );
}

function TransactionLedgerBody({ bankAccounts, refreshKey, initialMonth, initialYear, initialCategory, initialTab, initialDateFrom, initialDateTo }: Pick<TransactionLedgerTableProps, 'bankAccounts' | 'refreshKey' | 'initialMonth' | 'initialYear' | 'initialCategory' | 'initialTab' | 'initialDateFrom' | 'initialDateTo'>) {
  const defaultFY = getPresetDateRange('this-fy')!;

  // Calculate date range from initialMonth/initialYear if provided
  const getInitialDateRange = () => {
    if (initialMonth !== undefined && initialYear !== undefined) {
      // Use local date string directly to avoid UTC timezone offset issues
      const mm = String(initialMonth).padStart(2, '0');
      const lastDay = new Date(initialYear, initialMonth, 0).getDate();
      return {
        from: `${initialYear}-${mm}-01`,
        to: `${initialYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    if (initialDateFrom || initialDateTo) {
      return { from: initialDateFrom ?? defaultFY.from, to: initialDateTo ?? defaultFY.to };
    }
    return { from: defaultFY.from, to: defaultFY.to };
  };

  const initialDateRange = getInitialDateRange();
  const initialPreset: DatePreset = (initialMonth !== undefined && initialYear !== undefined)
    ? 'custom'
    : (initialDateFrom || initialDateTo) ? 'custom' : 'this-fy';

  const [activeTab, setActiveTab] = useState<TabFilter>(() => {
    const validTabs: TabFilter[] = ['all', 'expenses', 'income', 'excluded', 'reimbursements', 'uncategorized', 'voided', 'transfers'];
    return (initialTab && validTabs.includes(initialTab as TabFilter))
      ? (initialTab as TabFilter)
      : 'all';
  });
  const [bankAccountId, setBankAccountId] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [datePreset, setDatePreset] = useState<DatePreset>(initialPreset);
  const [dateFrom, setDateFrom] = useState<string | undefined>(initialDateRange.from);
  const [dateTo, setDateTo] = useState<string | undefined>(initialDateRange.to);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  // Rows that were recategorized away from the current tab's filter — kept visible so
  // the user can complete any follow-up action (e.g. reimbursement linking) before dismissing.
  const [retainedRows, setRetainedRows] = useState<Map<string, LedgerTransactionRow>>(new Map());
  // Review batch: transaction IDs that were auto-matched during a category update
  const [reviewBatch, setReviewBatch] = useState<string[] | null>(null);
  const [preReviewCategory, setPreReviewCategory] = useState<string | undefined>();
  const pendingCategoryRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Single active rule prompt — only one row's prompt shows at a time
  const [activeRulePrompt, setActiveRulePrompt] = useState<{
    transactionId: string;
    count: number;
    category: string;
  } | null>(null);
  const [transferDrawerTx, setTransferDrawerTx] = useState<{
    id: string;
    description: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    date: string;
    bankAccountId: string | null;
    bankAccountName: string | null;
  } | null>(null);
  const [smartMatchPair, setSmartMatchPair] = useState<{
    debitTransactionId: string;
    creditTransactionId: string;
  } | null>(null);
  const [donationDrawerOpen, setDonationDrawerOpen] = useState(false);
  const [zakatDrawerOpen, setZakatDrawerOpen] = useState(false);
  const [charitySelectedTransactionId, setCharitySelectedTransactionId] = useState<string>('');
  const previousRefreshKey = useRef(refreshKey);

  const queryInput: GetAllInput = useMemo(() => {
    const parsedAmountMin = parseAmount(amountMin);
    const parsedAmountMax = parseAmount(amountMax);

    return {
      limit: PAGE_SIZE,
      ...TAB_TO_PARAMS[activeTab],
      ...(activeTab === 'uncategorized' ? { uncategorized: true } : {}),
      ...(TAB_TO_PARAMS[activeTab].reimbursementOnly ? { reimbursementOnly: true } : {}),
      ...(TAB_TO_PARAMS[activeTab].transferOnly ? { transferOnly: true } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(category ? { category } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(parsedAmountMin !== undefined ? { amountMin: parsedAmountMin } : {}),
      ...(parsedAmountMax !== undefined ? { amountMax: parsedAmountMax } : {}),
      ...(reviewBatch !== null ? { ids: reviewBatch } : {}),
    } satisfies GetAllInput;
  }, [activeTab, bankAccountId, category, dateFrom, dateTo, debouncedSearch, amountMin, amountMax, reviewBatch]);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = trpc.transactionLedger.getAll.useInfiniteQuery(queryInput, {
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: (previousData) => previousData,
  });
  const utils = trpc.useUtils();

  const cancelPendingCategoryRefresh = useCallback(() => {
    if (pendingCategoryRefreshRef.current) {
      clearTimeout(pendingCategoryRefreshRef.current);
      pendingCategoryRefreshRef.current = null;
    }
  }, []);

  const schedulePendingCategoryRefresh = useCallback(() => {
    cancelPendingCategoryRefresh();
    pendingCategoryRefreshRef.current = setTimeout(() => {
      pendingCategoryRefreshRef.current = null;
      setActiveRulePrompt(null);
      void refetch();
    }, 4000);
  }, [cancelPendingCategoryRefresh, refetch]);

  const flushPendingCategoryRefresh = useCallback(() => {
    cancelPendingCategoryRefresh();
    setActiveRulePrompt(null);
    void refetch();
  }, [cancelPendingCategoryRefresh, refetch]);
  const filterOptionsQuery = trpc.transactionLedger.getFilterOptions.useQuery();
  const unmatchedCountQuery = trpc.transfer.getUnmatchedCount.useQuery(undefined, {
    enabled: activeTab === 'transfers',
  });
  const createRuleMutation = trpc.transferRule.createRuleFromPair.useMutation({
    onSuccess: (rule) => toast.success(`Rule "${rule.name}" saved`),
    onError: (err) => toast.error(err.message ?? 'Failed to save rule'),
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (previousRefreshKey.current !== refreshKey) {
      previousRefreshKey.current = refreshKey;
      void refetch();
    }
  }, [refreshKey, refetch]);

  useEffect(() => {
    return () => {
      cancelPendingCategoryRefresh();
    };
  }, [cancelPendingCategoryRefresh]);

  const updateCategoryMutation = trpc.transactionLedger.updateCategory.useMutation({
    onSuccess: (result) => {
      setSavingId(null);
      void utils.transactionLedger.searchDebitTransactions.invalidate();
      void utils.transactionLedger.getAll.invalidate();
      if (result.matchedIds.length > 0) {
        cancelPendingCategoryRefresh();
        setPreReviewCategory(category); // save so we can restore on exit
        setReviewBatch(result.matchedIds); // queryInput reacts → auto-refetches with ids filter
        toast.success(
          `Category updated for ${result.matchedIds.length} matching transaction${result.matchedIds.length > 1 ? 's' : ''} — scroll to review`,
          { duration: 5000 },
        );
      } else {
        schedulePendingCategoryRefresh(); // keep the row mounted long enough for the prompt to appear
        toast.success('Category updated');
      }
    },
    onError: (error) => {
      setSavingId(null);
      toast.error(error.message);
    },
  });

  const handleCategoryChange = useCallback(
    (id: string, newCategory: string, offsetCategory?: string, offsetTransactionId?: string | null, applyToMatching?: boolean) => {
      const txData = data?.pages.flatMap(p => p.transactions).find(tx => tx.id === id) ?? retainedRows.get(id);
      if (txData) {
        // Transfers tab: retain row when moving away from Transfer category so the
        // user can complete follow-up actions (e.g. linking the transfer pair).
        if (activeTab === 'transfers') {
          if (newCategory !== TRANSFER_CATEGORY) {
            setRetainedRows(prev => {
              const next = new Map(prev);
              next.set(id, { ...txData, category: newCategory });
              return next;
            });
          } else {
            // Re-categorized back to Transfer — remove from retained (it'll reappear normally)
            setRetainedRows(prev => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
          }
        }
      }
      setSavingId(id);
      updateCategoryMutation.mutate({
        id,
        newCategory,
        ...(offsetCategory ? { offsetCategory } : {}),
        ...(offsetTransactionId !== undefined ? { offsetTransactionId: offsetTransactionId ?? undefined } : {}),
        ...(applyToMatching === false ? { applyToMatching: false } : {}),
      });
    },
    [updateCategoryMutation, activeTab, data, retainedRows],
  );

  const handleDismissRetained = useCallback((id: string) => {
    setRetainedRows(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleExitReview = useCallback(() => {
    cancelPendingCategoryRefresh();
    setReviewBatch(null);
    setActiveRulePrompt(null);
    setCategory(preReviewCategory); // restore the filter the user had before review
    setPreReviewCategory(undefined);
  }, [cancelPendingCategoryRefresh, preReviewCategory]);

  const handleReset = useCallback(() => {
    cancelPendingCategoryRefresh();
    setBankAccountId(undefined);
    setCategory(undefined);
    const fy = getPresetDateRange('this-fy')!;
    setDateFrom(fy.from);
    setDateTo(fy.to);
    setAmountMin('');
    setAmountMax('');
    setSearch('');
    setDebouncedSearch('');
    setActiveTab('all');
    setReviewBatch(null);
    setRetainedRows(new Map());
    setActiveRulePrompt(null);
    setResetKey((k) => k + 1);
  }, [cancelPendingCategoryRefresh]);

  const handleTabChange = useCallback((tab: TabFilter) => {
    cancelPendingCategoryRefresh();
    setActiveTab(tab);
    setRetainedRows(new Map());
    setReviewBatch(null);
    setActiveRulePrompt(null);
  }, [cancelPendingCategoryRefresh]);

  const loading = isLoading; // Only blank the table on initial load; background refetches use isFetching
  const syncing = !isLoading && isFetching; // Background sync — show subtle indicator without blanking table
  const transactions = data?.pages.flatMap((p) => p.transactions) ?? [];
  // Retained rows: recategorized on this tab but kept visible until dismissed
  const retainedVisible = useMemo(() => {
    const currentIds = new Set(transactions.map(tx => tx.id));
    return [...retainedRows.entries()]
      .filter(([id]) => !currentIds.has(id))
      .map(([, tx]) => tx);
  }, [transactions, retainedRows]);
  const expenseCategories = filterOptionsQuery.data?.expenseCategories ?? [];
  const incomeSourceLabels = filterOptionsQuery.data?.incomeSourceLabels ?? [];
  const lastPage = data?.pages[data.pages.length - 1];
  const categoryOptions = useMemo(() => {
    const incomeGroup = {
      label: '💰 Income Sources',
      options: incomeSourceLabels
        .map((item) => ({ label: item.name, value: item.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };

    const expenseGroup = {
      label: '🏷️ Expense Categories',
      options: expenseCategories
        .map((item) => ({ label: item.name, value: item.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };

    const specialGroup = {
      label: '⚡ Special',
      options: [
        { label: REIMBURSEMENT_CATEGORY, value: REIMBURSEMENT_CATEGORY },
        { label: TRANSFER_CATEGORY, value: TRANSFER_CATEGORY },
      ],
    };

    return [incomeGroup, expenseGroup, specialGroup].filter((g) => g.options.length > 0);
  }, [expenseCategories, incomeSourceLabels]);

  return (
    <>
    <section className="space-y-4">
      <div className="flex flex-wrap gap-4 border-b border-gray-200 dark:border-gray-700">
        {(['all', 'expenses', 'income', 'reimbursements', 'excluded', 'uncategorized', 'voided'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={`flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {tab}
            {TAB_INFO[tab] && <InfoTooltip text={TAB_INFO[tab]} />}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleTabChange('transfers')}
          className={`flex items-center border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
            activeTab === 'transfers'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <span>Transfers</span>
          <UnmatchedTransfersBadge count={unmatchedCountQuery.data ?? 0} />
        </button>
      </div>

      {activeTab === 'transfers' && (
        <OrphanResolutionPanel onResolved={() => void refetch()} />
      )}

      <TransactionFilters
        bankAccounts={bankAccounts}
        categoryOptions={categoryOptions}
        bankAccountId={bankAccountId}
        category={category}
        dateFrom={dateFrom}
        dateTo={dateTo}
        datePreset={datePreset}
        search={search}
        amountMin={amountMin}
        amountMax={amountMax}
        onBankChange={(v) => {
          setBankAccountId(v);
        }}
        onCategoryChange={(v) => {
          setCategory(v);
        }}
        onDateFromChange={(v) => {
          setDateFrom(v);
        }}
        onDateToChange={(v) => {
          setDateTo(v);
        }}
        onDatePresetChange={(preset) => {
          setDatePreset(preset);
        }}
        onSearchChange={(v) => {
          setSearch(v);
        }}
        onAmountMinChange={(v) => {
          setAmountMin(v);
        }}
        onAmountMaxChange={(v) => {
          setAmountMax(v);
        }}
        onReset={handleReset}
        resetKey={resetKey}
      />

      {reviewBatch !== null && (
        <div className="flex items-center justify-between rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm dark:border-teal-700 dark:bg-teal-900/20">
          <span className="text-teal-800 dark:text-teal-200">
            Reviewing <strong>{reviewBatch.length}</strong> auto-updated transaction{reviewBatch.length !== 1 ? 's' : ''} — inline edit any row to correct it (changes here apply to this transaction only)
          </span>
          <button
            type="button"
            onClick={handleExitReview}
            className="ml-4 text-xs font-medium text-teal-700 underline hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
          >
            Exit review
          </button>
        </div>
      )}

      {!loading && lastPage && (lastPage.totalDebitAmount > 0 || lastPage.totalCreditAmount > 0) && (
        <TransactionSummary totalDebitAmount={lastPage.totalDebitAmount} totalCreditAmount={lastPage.totalCreditAmount} />
      )}

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading transactions...</p>
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">No transactions found</p>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-xl border bg-white dark:bg-gray-900 transition-colors ${syncing ? 'border-teal-400 dark:border-teal-600' : 'border-gray-200 dark:border-gray-700'}`}>
          <table className="w-full table-layout-fixed" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '32px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-1 py-3" />
                {['Date', 'Description', 'Amount', 'Type', 'Category', 'Source', 'Status', 'Bank Account', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className={`select-none cursor-default overflow-hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 ${
                      h === 'Source' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  expenseCategories={expenseCategories}
                  incomeSourceLabels={incomeSourceLabels}
                  onCategoryChange={handleCategoryChange}
                  isSaving={savingId === transaction.id}
                  colCount={10}
                  isInReviewBatch={reviewBatch !== null && reviewBatch.includes(transaction.id)}
                  showRulePrompt={activeRulePrompt?.transactionId === transaction.id}
                  rulePromptCount={activeRulePrompt?.transactionId === transaction.id ? activeRulePrompt.count : 0}
                  onRulePromptDismiss={() => setActiveRulePrompt(null)}
                  onSuggestRule={(count, cat) => setActiveRulePrompt({ transactionId: transaction.id, count, category: cat })}
                  onClearRulePrompt={() => setActiveRulePrompt((prev) => prev?.transactionId === transaction.id ? null : prev)}
                  onPausePendingRefresh={cancelPendingCategoryRefresh}
                  onResolvePendingRefresh={flushPendingCategoryRefresh}
                  onVoided={() => void refetch()}
                  onRestored={() => void refetch()}
                  onUnlinked={() => void refetch()}
                  onLinkTransfer={
                    transaction.isTransferClassified &&
                    !transaction.transferLinkedTransactionId &&
                    !transaction.transferCounterpartId
                      ? () =>
                          setTransferDrawerTx({
                            id: transaction.id,
                            description: transaction.description,
                            amount: transaction.amount,
                            type: transaction.type as 'DEBIT' | 'CREDIT',
                            date: transaction.date,
                            bankAccountId: transaction.bankAccountId,
                            bankAccountName: transaction.bankAccountName,
                          })
                      : undefined
                  }
                  onClassifyAsDonation={() => {
                    setCharitySelectedTransactionId(transaction.id);
                    setDonationDrawerOpen(true);
                  }}
                  onClassifyAsZakat={() => {
                    setCharitySelectedTransactionId(transaction.id);
                    setZakatDrawerOpen(true);
                  }}
                />
              ))}
              {retainedVisible.map((tx) => (
                <Fragment key={`retained-${tx.id}`}>
                  <tr className="bg-amber-50 dark:bg-amber-900/20">
                    <td colSpan={10} className="px-4 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          Moved to <strong>{tx.category}</strong> — kept visible so you can complete any linking
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDismissRetained(tx.id)}
                          className="ml-4 text-xs text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                  <TransactionRow
                    transaction={tx}
                    expenseCategories={expenseCategories}
                    incomeSourceLabels={incomeSourceLabels}
                    onCategoryChange={handleCategoryChange}
                    isSaving={savingId === tx.id}
                    colCount={10}
                    showRulePrompt={activeRulePrompt?.transactionId === tx.id}
                    rulePromptCount={activeRulePrompt?.transactionId === tx.id ? activeRulePrompt.count : 0}
                    onRulePromptDismiss={() => setActiveRulePrompt(null)}
                    onSuggestRule={(count, cat) => setActiveRulePrompt({ transactionId: tx.id, count, category: cat })}
                    onClearRulePrompt={() => setActiveRulePrompt((prev) => prev?.transactionId === tx.id ? null : prev)}
                    onPausePendingRefresh={cancelPendingCategoryRefresh}
                    onResolvePendingRefresh={flushPendingCategoryRefresh}
                    onVoided={() => { handleDismissRetained(tx.id); void refetch(); }}
                    onRestored={() => { handleDismissRetained(tx.id); void refetch(); }}
                    onUnlinked={() => void refetch()}
                    onClassifyAsDonation={() => {
                      setCharitySelectedTransactionId(tx.id);
                      setDonationDrawerOpen(true);
                    }}
                    onClassifyAsZakat={() => {
                      setCharitySelectedTransactionId(tx.id);
                      setZakatDrawerOpen(true);
                    }}
                  />
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {hasNextPage && (
          <div className="flex justify-center py-4 w-full">
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-teal-400 dark:hover:bg-teal-900/20"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more transactions'}
            </button>
          </div>
        )}
      </div>
    </section>

    {transferDrawerTx && (
      <TransferLinkDrawer
        open={transferDrawerTx !== null}
        onClose={() => setTransferDrawerTx(null)}
        sourceTransaction={transferDrawerTx}
        onLinked={(pair) => {
          void refetch();
          if (pair) setSmartMatchPair(pair);
        }}
      />
    )}
    {smartMatchPair && (
      <SmartMatchDialog
        open={true}
        onClose={() => setSmartMatchPair(null)}
        sourcePair={smartMatchPair}
        onBatchLinked={() => void refetch()}
        onSaveRule={({ debitTransactionId, creditTransactionId, suggestedName }) => {
          createRuleMutation.mutate({ debitTransactionId, creditTransactionId, name: suggestedName });
          setSmartMatchPair(null);
        }}
      />
    )}
    {donationDrawerOpen && dateFrom && dateTo && (
      <LinkTransactionsDrawer
        isOpen={donationDrawerOpen}
        onClose={() => {
          setDonationDrawerOpen(false);
          setCharitySelectedTransactionId('');
          void refetch();
        }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectedTransactionId={charitySelectedTransactionId}
      />
    )}
    {zakatDrawerOpen && dateFrom && dateTo && (
      <LinkZakatTransactionsDrawer
        isOpen={zakatDrawerOpen}
        onClose={() => {
          setZakatDrawerOpen(false);
          setCharitySelectedTransactionId('');
          void refetch();
        }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectedTransactionId={charitySelectedTransactionId}
      />
    )}
  </>
  );
}
