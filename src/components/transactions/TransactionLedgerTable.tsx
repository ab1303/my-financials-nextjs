'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/server/trpc/client';
import TransactionFilters from './TransactionFilters';
import TransactionRow from './TransactionRow';

type TabFilter = 'all' | 'expenses' | 'income' | 'excluded';

type GetAllInput = {
  page: number;
  limit: number;
  type?: 'DEBIT' | 'CREDIT';
  status?: 'PENDING' | 'CONFIRMED' | 'EXCLUDED';
  bankAccountId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

interface TransactionLedgerTableProps {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  refreshKey?: number;
}

const PAGE_SIZE = 50;

const TAB_TO_PARAMS: Record<TabFilter, Partial<Pick<GetAllInput, 'type' | 'status'>>> = {
  all: {},
  expenses: { type: 'DEBIT', status: 'CONFIRMED' },
  income: { type: 'CREDIT', status: 'CONFIRMED' },
  excluded: { status: 'EXCLUDED' },
};

export default function TransactionLedgerTable({
  bankAccounts,
  refreshKey,
}: TransactionLedgerTableProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [page, setPage] = useState(1);
  const [bankAccountId, setBankAccountId] = useState<string | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const previousRefreshKey = useRef(refreshKey);

  const queryInput: GetAllInput = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...TAB_TO_PARAMS[activeTab],
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [page, activeTab, bankAccountId, dateFrom, dateTo, debouncedSearch],
  );

  const { data, isLoading, isFetching, refetch } = trpc.transactionLedger.getAll.useQuery(queryInput);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (previousRefreshKey.current !== refreshKey) {
      previousRefreshKey.current = refreshKey;
      void refetch();
    }
  }, [refreshKey, refetch]);

  const [savingId, setSavingId] = useState<string | null>(null);

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
    (id: string, newCategory: string) => {
      setSavingId(id);
      updateCategoryMutation.mutate({ id, newCategory });
    },
    [updateCategoryMutation],
  );

  const handleReset = useCallback(() => {
    setBankAccountId(undefined);
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
    setActiveTab('all');
  }, []);

  const handleTabChange = useCallback((tab: TabFilter) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  const loading = isLoading || isFetching;
  const transactions = data?.transactions ?? [];
  const expenseCategories = data?.expenseCategories ?? [];
  const incomeSourceLabels = data?.incomeSourceLabels ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-4 border-b border-gray-200 dark:border-gray-700">
        {(['all', 'expenses', 'income', 'excluded'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <TransactionFilters
        bankAccounts={bankAccounts}
        bankAccountId={bankAccountId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        search={search}
        onBankChange={(value) => {
          setBankAccountId(value);
          setPage(1);
        }}
        onDateFromChange={(value) => {
          setDateFrom(value);
          setPage(1);
        }}
        onDateToChange={(value) => {
          setDateTo(value);
          setPage(1);
        }}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onReset={handleReset}
      />

      {loading ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading transactions...</p>
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 rounded bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">No transactions found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Bank Account
                </th>
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
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={(data?.totalPages ?? 1) <= page}
            onClick={() => setPage((current) => current + 1)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
