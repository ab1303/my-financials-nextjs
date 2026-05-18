'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { trpc } from '@/server/trpc/client';
import { REIMBURSEMENT_CATEGORY, TRANSFER_CATEGORY } from '@/server/services/transactions/constants';
import TransactionFilters, { getPresetDateRange } from './TransactionFilters';
import TransactionRow from './TransactionRow';
import { CategoryFilteredLedger } from './CategoryFilteredLedger';
import TransferLinkDrawer from '@/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer';
import SmartMatchDialog from '@/app/(authorized)/cashflow/transactions/_components/transfer/SmartMatchDialog';
import UnmatchedTransfersBadge from '@/app/(authorized)/cashflow/transactions/_components/transfer/UnmatchedTransfersBadge';

type TabFilter = 'all' | 'expenses' | 'income' | 'excluded' | 'reimbursements' | 'uncategorized' | 'voided' | 'transfers';

type GetAllInput = {
  page: number;
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
};

interface TransactionLedgerTableProps {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  refreshKey?: number;
  initialCategory?: string;
  initialMonth?: number;
  initialYear?: number;
}

const PAGE_SIZE = 50;

const TAB_TO_PARAMS: Record<TabFilter, Partial<Pick<GetAllInput, 'type' | 'status' | 'reimbursementOnly' | 'transferOnly' | 'excludeTransferCategory'>>> = {
  all: {},
  expenses: { type: 'DEBIT', status: 'CONFIRMED' },
  income: { type: 'CREDIT', status: 'CONFIRMED' },
  excluded: { status: 'EXCLUDED', excludeTransferCategory: true },
  reimbursements: { type: 'CREDIT', status: 'CONFIRMED', reimbursementOnly: true },
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
  initialCategory,
  initialMonth,
  initialYear,
}: TransactionLedgerTableProps) {
  const isCategoryFilteredView = !!(initialCategory && initialMonth !== undefined);

  if (isCategoryFilteredView) {
    return (
      <CategoryFilteredLedger
        category={initialCategory}
        month={initialMonth!}
        year={initialYear ?? new Date().getFullYear()}
      />
    );
  }

  return <TransactionLedgerBody bankAccounts={bankAccounts} refreshKey={refreshKey} />;
}

function TransactionLedgerBody({ bankAccounts, refreshKey }: Pick<TransactionLedgerTableProps, 'bankAccounts' | 'refreshKey'>) {
  const defaultFY = getPresetDateRange('this-fy')!;
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [page, setPage] = useState(1);
  const [bankAccountId, setBankAccountId] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<string | undefined>(defaultFY.from);
  const [dateTo, setDateTo] = useState<string | undefined>(defaultFY.to);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
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
  const previousRefreshKey = useRef(refreshKey);

  const queryInput: GetAllInput = useMemo(() => {
    const parsedAmountMin = parseAmount(amountMin);
    const parsedAmountMax = parseAmount(amountMax);

    return {
      page,
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
    } satisfies GetAllInput;
  }, [page, activeTab, bankAccountId, category, dateFrom, dateTo, debouncedSearch, amountMin, amountMax]);

  const { data, isLoading, isFetching, refetch } = trpc.transactionLedger.getAll.useQuery(queryInput);
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

  const updateCategoryMutation = trpc.transactionLedger.updateCategory.useMutation({
    onSuccess: () => {
      setSavingId(null);
      void refetch();
      toast.success('Category updated');
    },
    onError: (error) => {
      setSavingId(null);
      toast.error(error.message);
    },
  });

  const handleCategoryChange = useCallback(
    (id: string, newCategory: string, offsetCategory?: string, offsetTransactionId?: string | null) => {
      setSavingId(id);
      updateCategoryMutation.mutate({
        id,
        newCategory,
        ...(offsetCategory ? { offsetCategory } : {}),
        ...(offsetTransactionId !== undefined ? { offsetTransactionId: offsetTransactionId ?? undefined } : {}),
      });
    },
    [updateCategoryMutation],
  );

  const handleReset = useCallback(() => {
    setBankAccountId(undefined);
    setCategory(undefined);
    const fy = getPresetDateRange('this-fy')!;
    setDateFrom(fy.from);
    setDateTo(fy.to);
    setAmountMin('');
    setAmountMax('');
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
    setActiveTab('all');
    setResetKey((k) => k + 1);
  }, []);

  const handleTabChange = useCallback((tab: TabFilter) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  const loading = isLoading; // Only blank the table on initial load; background refetches use isFetching
  const syncing = !isLoading && isFetching; // Background sync — show subtle indicator without blanking table
  const transactions = data?.transactions ?? [];
  const expenseCategories = filterOptionsQuery.data?.expenseCategories ?? [];
  const incomeSourceLabels = filterOptionsQuery.data?.incomeSourceLabels ?? [];
  const categoryOptions = useMemo(() => {
    const incomeGroup = {
      label: '💰 Income Sources',
      options: incomeSourceLabels
        .map((name) => ({ label: name, value: name }))
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

      <TransactionFilters
        bankAccounts={bankAccounts}
        categoryOptions={categoryOptions}
        bankAccountId={bankAccountId}
        category={category}
        dateFrom={dateFrom}
        dateTo={dateTo}
        search={search}
        amountMin={amountMin}
        amountMax={amountMax}
        onBankChange={(v) => {
          setBankAccountId(v);
          setPage(1);
        }}
        onCategoryChange={(v) => {
          setCategory(v);
          setPage(1);
        }}
        onDateFromChange={(v) => {
          setDateFrom(v);
          setPage(1);
        }}
        onDateToChange={(v) => {
          setDateTo(v);
          setPage(1);
        }}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onAmountMinChange={(v) => {
          setAmountMin(v);
          setPage(1);
        }}
        onAmountMaxChange={(v) => {
          setAmountMax(v);
          setPage(1);
        }}
        onReset={handleReset}
        resetKey={resetKey}
      />

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
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="w-8 px-1 py-3" />
                {['Date', 'Description', 'Amount', 'Type', 'Category', 'Source', 'Status', 'Bank Account', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className={`select-none cursor-default px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 ${
                      h === 'Source' ? 'w-20 text-center' : 'text-left'
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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Page {data?.page ?? page} of {data?.totalPages ?? 1}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((c) => Math.max(1, c - 1))}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={(data?.totalPages ?? 1) <= page}
            onClick={() => setPage((c) => c + 1)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
          >
            Next
          </button>
        </div>
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
  </>
  );
}
