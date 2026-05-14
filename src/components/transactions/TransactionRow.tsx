'use client';

import { useEffect, useState } from 'react';
import { REIMBURSEMENT_CATEGORY } from '@/server/services/transactions/constants';
import { trpc } from '@/server/trpc/client';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';
import ReimbursementSubRow from './ReimbursementSubRow';

interface TransactionRowProps {
  transaction: LedgerTransactionRow;
  expenseCategories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  onCategoryChange: (
    id: string,
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,
  ) => void;
  isSaving?: boolean;
  colCount?: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

export default function TransactionRow({
  transaction,
  expenseCategories,
  incomeSourceLabels,
  onCategoryChange,
  isSaving = false,
  colCount = 9,
}: TransactionRowProps) {
  const statusClasses: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    EXCLUDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  const [localCategory, setLocalCategory] = useState(transaction.category);
  const [localOffsetCategory, setLocalOffsetCategory] = useState(transaction.offsetCategory ?? '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [localOffsetTxId, setLocalOffsetTxId] = useState<string | null>(transaction.offsetTransactionId ?? null);

  useEffect(() => {
    setLocalCategory(transaction.category);
  }, [transaction.category]);

  useEffect(() => {
    setLocalOffsetCategory(transaction.offsetCategory ?? '');
  }, [transaction.offsetCategory]);

  useEffect(() => {
    setLocalOffsetTxId(transaction.offsetTransactionId ?? null);
  }, [transaction.offsetTransactionId]);

  const searchQuery = trpc.transactionLedger.searchDebitTransactions.useQuery(
    { search: pickerSearch, limit: 10 },
    { enabled: pickerOpen },
  );

  const amountClass = transaction.type === 'DEBIT' ? 'text-red-600' : 'text-green-600';
  const options = transaction.type === 'DEBIT' ? expenseCategories : incomeSourceLabels;

  const showReimbursementOption =
    transaction.type === 'CREDIT' &&
    (transaction.status === 'EXCLUDED' || transaction.category === REIMBURSEMENT_CATEGORY);

  const totalReimbursed = transaction.reimbursements.reduce((sum, reimbursement) => sum + reimbursement.amount, 0);
  const netAmount = transaction.amount - totalReimbursed;
  const hasReimbursements = transaction.reimbursements.length > 0;

  function handleChange(newCategory: string) {
    setLocalCategory(newCategory);
    if (newCategory !== REIMBURSEMENT_CATEGORY) {
      setLocalOffsetCategory('');
      onCategoryChange(transaction.id, newCategory);
    }
  }

  function handleOffsetChange(newOffsetCategory: string) {
    setLocalOffsetCategory(newOffsetCategory);
    onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, newOffsetCategory, localOffsetTxId);
  }

  function handleLinkTransaction(linkedId: string | null) {
    setLocalOffsetTxId(linkedId);
    setPickerOpen(false);
    setPickerSearch('');
    onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, localOffsetCategory || undefined, linkedId);
  }

  return (
    <>
      <tr className="border-b border-gray-200 dark:border-gray-700">
        <td className="w-8 px-1 py-3 text-center">
          {hasReimbursements && (
            <button
              type="button"
              aria-label={isExpanded ? 'Collapse reimbursements' : 'Expand reimbursements'}
              onClick={() => setIsExpanded((v) => !v)}
              className="text-gray-400 transition-colors hover:text-teal-500"
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{transaction.date.slice(0, 10)}</td>
        <td className="max-w-[240px] px-4 py-3 text-sm text-gray-900 dark:text-white">
          <span className="block truncate" title={transaction.description}>
            {transaction.description}
          </span>
        </td>
        <td className={`px-4 py-3 text-sm font-medium tabular-nums ${amountClass}`}>
          <div className="flex flex-col">
            <span>{formatCurrency(transaction.amount)}</span>
            {hasReimbursements && <span className="text-xs text-teal-600 dark:text-teal-400">net {formatCurrency(netAmount)}</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{transaction.type}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <select
              aria-label={`Category for ${transaction.description}`}
              value={localCategory}
              disabled={isSaving}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full min-w-[140px] rounded border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-wait disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {options.map((option) => {
                const value = typeof option === 'string' ? option : option.name;
                const key = typeof option === 'string' ? option : option.id;
                return (
                  <option key={key} value={value}>
                    {value}
                  </option>
                );
              })}
              {showReimbursementOption && <option value={REIMBURSEMENT_CATEGORY}>{REIMBURSEMENT_CATEGORY}</option>}
            </select>

            {localCategory === REIMBURSEMENT_CATEGORY && (
              <>
                <select
                  aria-label={`Offsets expense category for ${transaction.description}`}
                  value={localOffsetCategory}
                  disabled={isSaving}
                  onChange={(e) => handleOffsetChange(e.target.value)}
                  className="w-full min-w-[140px] rounded border border-teal-400 bg-transparent px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-wait disabled:opacity-60 dark:border-teal-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="" disabled>
                    Offsets category…
                  </option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="mt-1">
                  {localOffsetTxId ? (
                    <div className="flex items-center gap-1 rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs dark:border-teal-700 dark:bg-teal-950/30">
                      <span className="text-teal-500">🔗</span>
                      <span className="truncate text-teal-700 dark:text-teal-300">
                        {searchQuery.data?.find((t) => t.id === localOffsetTxId)?.description ?? 'Linked expense'}
                      </span>
                      <button
                        type="button"
                        aria-label="Unlink expense"
                        onClick={() => handleLinkTransaction(null)}
                        className="ml-auto text-gray-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ) : !pickerOpen ? (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="text-xs text-teal-600 hover:underline dark:text-teal-400"
                    >
                      ＋ Link to original expense
                    </button>
                  ) : (
                    <div className="relative">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search expenses…"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        className="w-full rounded border border-teal-400 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-gray-800 dark:text-white"
                      />
                      {searchQuery.data && searchQuery.data.length > 0 && (
                        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-md dark:border-gray-600 dark:bg-gray-800">
                          {searchQuery.data.map((tx) => (
                            <li key={tx.id}>
                              <button
                                type="button"
                                onClick={() => handleLinkTransaction(tx.id)}
                                className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-teal-50 dark:hover:bg-teal-900/20"
                              >
                                <span className="truncate">{tx.description}</span>
                                <span className="ml-2 shrink-0 tabular-nums text-gray-500">
                                  {tx.date} · {formatCurrency(tx.amount)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPickerOpen(false);
                          setPickerSearch('');
                        }}
                        className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{transaction.source}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClasses[transaction.status] ?? statusClasses.EXCLUDED}`}>
              {transaction.status}
            </span>
            {transaction.category === REIMBURSEMENT_CATEGORY && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                ↩ {transaction.offsetCategory ?? 'Reimbursement'}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {transaction.bankAccountName
            ? `${transaction.bankAccountName}${transaction.bankName ? ` (${transaction.bankName})` : ''}`
            : transaction.bankName ?? '-'}
        </td>
      </tr>

      {isExpanded && transaction.reimbursements.map((r) => <ReimbursementSubRow key={r.id} reimbursement={r} colCount={colCount} />)}
    </>
  );
}
