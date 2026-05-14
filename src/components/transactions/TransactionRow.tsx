'use client';

import { useEffect, useState } from 'react';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';
import { REIMBURSEMENT_CATEGORY } from '@/server/services/transactions/constants';

interface TransactionRowProps {
  transaction: LedgerTransactionRow;
  expenseCategories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  onCategoryChange: (id: string, newCategory: string, offsetCategory?: string) => void;
  isSaving?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}

export default function TransactionRow({
  transaction,
  expenseCategories,
  incomeSourceLabels,
  onCategoryChange,
  isSaving = false,
}: TransactionRowProps) {
  const statusClasses: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    EXCLUDED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  const [localCategory, setLocalCategory] = useState(transaction.category);
  const [localOffsetCategory, setLocalOffsetCategory] = useState(transaction.offsetCategory ?? '');

  useEffect(() => {
    setLocalCategory(transaction.category);
  }, [transaction.category]);

  useEffect(() => {
    setLocalOffsetCategory(transaction.offsetCategory ?? '');
  }, [transaction.offsetCategory]);

  const amountClass = transaction.type === 'DEBIT' ? 'text-red-600' : 'text-green-600';
  const options = transaction.type === 'DEBIT' ? expenseCategories : incomeSourceLabels;

  const showReimbursementOption =
    transaction.type === 'CREDIT' &&
    (transaction.status === 'EXCLUDED' || transaction.category === REIMBURSEMENT_CATEGORY);

  function handleChange(newCategory: string) {
    setLocalCategory(newCategory);
    if (newCategory !== REIMBURSEMENT_CATEGORY) {
      setLocalOffsetCategory('');
      onCategoryChange(transaction.id, newCategory);
    }
  }

  function handleOffsetChange(newOffsetCategory: string) {
    setLocalOffsetCategory(newOffsetCategory);
    onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, newOffsetCategory);
  }

  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{transaction.date.slice(0, 10)}</td>
      <td className="max-w-[240px] px-4 py-3 text-sm text-gray-900 dark:text-white">
        <span className="block truncate" title={transaction.description}>{transaction.description}</span>
      </td>
      <td className={`px-4 py-3 text-sm font-medium tabular-nums ${amountClass}`}>{formatCurrency(transaction.amount)}</td>
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
            {showReimbursementOption && (
              <option value={REIMBURSEMENT_CATEGORY}>{REIMBURSEMENT_CATEGORY}</option>
            )}
          </select>

          {localCategory === REIMBURSEMENT_CATEGORY && (
            <select
              aria-label={`Offsets expense category for ${transaction.description}`}
              value={localOffsetCategory}
              disabled={isSaving}
              onChange={(e) => handleOffsetChange(e.target.value)}
              className="w-full min-w-[140px] rounded border border-teal-400 bg-transparent px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-wait disabled:opacity-60 dark:border-teal-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="" disabled>Offsets category…</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{transaction.source}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClasses[transaction.status] ?? statusClasses.EXCLUDED}`}>
          {transaction.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {transaction.bankAccountName
          ? `${transaction.bankAccountName}${transaction.bankName ? ` (${transaction.bankName})` : ''}`
          : transaction.bankName ?? '-'}
      </td>
    </tr>
  );
}
