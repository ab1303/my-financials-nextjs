'use client';

import { useMemo, useState } from 'react';
import TransactionReviewTable, { type ClassifiedMonth as SharedClassifiedMonth } from '@/components/csv-import/TransactionReviewTable';
import type { ClassifiedCreditMonth } from '@/server/services/ai-import/_types';
import type { ClassifiedMonth } from './_types';

interface CSVTransactionReviewTableProps {
  debitMonths: ClassifiedMonth[];
  creditMonths: ClassifiedCreditMonth[];
  categories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  llmModel: string;
  onConfirm: (debitMonths: ClassifiedMonth[], creditMonths: ClassifiedCreditMonth[]) => Promise<void>;
  isConfirming: boolean;
}

function CreditReviewPanel({
  months,
  incomeSourceLabels,
  onUpdate,
  filterMode = 'income',
}: {
  months: ClassifiedCreditMonth[];
  incomeSourceLabels: string[];
  onUpdate: (months: ClassifiedCreditMonth[]) => void;
  filterMode?: 'income' | 'excluded';
}) {
  const handleCategoryChange = (monthIdx: number, txIdx: number, newCategory: string) => {
    const updated = months.map((m, mi) => {
      if (mi !== monthIdx) return m;
      return {
        ...m,
        transactions: m.transactions.map((tx, ti) => {
          if (ti !== txIdx) return tx;
          return {
            ...tx,
            confirmedCategory: newCategory,
            overridden: newCategory !== tx.llmCategory,
          };
        }),
      };
    });
    onUpdate(updated);
  };

  const isExcludedTx = (category: string) =>
    category === 'Excluded' || category === 'Transfer';

  const filteredMonths = months
    .map((month, monthIdx) => ({
      month,
      monthIdx,
      visible: month.transactions.filter((tx) =>
        filterMode === 'excluded' ? isExcludedTx(tx.confirmedCategory) : !isExcludedTx(tx.confirmedCategory),
      ),
    }))
    .filter(({ visible }) => visible.length > 0);

  if (filteredMonths.length === 0) {
    return (
      <p className='py-4 text-sm text-gray-500 dark:text-gray-400'>
        {filterMode === 'excluded' ? 'No excluded transactions.' : 'No income / credit transactions found.'}
      </p>
    );
  }

  return (
    <div className='space-y-6'>
      {filteredMonths.map(({ month, monthIdx, visible }) => (
        <div key={month.month}>
          <h3 className='mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200'>{month.month}</h3>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='border-b border-gray-200 dark:border-gray-700'>
                <th className='py-2 pr-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400'>Date</th>
                <th className='py-2 pr-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400'>Description</th>
                <th className='py-2 pr-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400'>Amount</th>
                <th className='py-2 pr-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400'>LLM Suggested</th>
                <th className='py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400'>Your Classification</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tx) => {
                const txIdx = month.transactions.indexOf(tx);
                const excluded = isExcludedTx(tx.confirmedCategory);
                return (
                  <tr
                    key={tx.id}
                    className={`border-b border-gray-100 dark:border-gray-700 ${tx.overridden ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
                  >
                    <td className={`py-2 pr-4 ${excluded ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
                      {tx.date}
                    </td>
                    <td className={`max-w-[200px] truncate py-2 pr-4 ${excluded ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                      {tx.description}
                    </td>
                    <td className={`py-2 pr-4 text-right ${excluded ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className='py-2 pr-4 text-xs text-gray-500 dark:text-gray-400'>{tx.llmCategory}</td>
                    <td className='py-2'>
                      <select
                        value={tx.confirmedCategory}
                        onChange={(e) => handleCategoryChange(monthIdx, txIdx, e.target.value)}
                        className='w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                      >
                        {!incomeSourceLabels.includes(tx.confirmedCategory) && (
                          <option value={tx.confirmedCategory}>{tx.confirmedCategory}</option>
                        )}
                        {incomeSourceLabels.map((label) => (
                          <option key={label} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default function CSVTransactionReviewTable({
  debitMonths,
  creditMonths,
  categories,
  incomeSourceLabels,
  llmModel,
  onConfirm,
  isConfirming,
}: CSVTransactionReviewTableProps) {
  const [activeTab, setActiveTab] = useState<'debits' | 'credits' | 'excluded'>('debits');
  const [localDebitMonths, setLocalDebitMonths] = useState(debitMonths);
  const [localCreditMonths, setLocalCreditMonths] = useState(creditMonths);

  const totalDebitCount = useMemo(
    () => localDebitMonths.reduce((sum, month) => sum + month.transactions.length, 0),
    [localDebitMonths],
  );
  const totalCreditCount = useMemo(
    () => localCreditMonths.reduce((sum, month) => sum + month.transactions.length, 0),
    [localCreditMonths],
  );
  const excludedCount = useMemo(
    () =>
      localCreditMonths.reduce(
        (sum, month) =>
          sum + month.transactions.filter((tx) => tx.confirmedCategory === 'Transfer' || tx.confirmedCategory === 'Excluded').length,
        0,
      ),
    [localCreditMonths],
  );

  const nonExcludedCreditCount = useMemo(
    () => totalCreditCount - excludedCount,
    [totalCreditCount, excludedCount],
  );

  // Calculate flagged transaction count (HIGH or MEDIUM transfer likelihood)
  const flaggedCount = useMemo(() => {
    const debitFlagged = localDebitMonths.reduce(
      (sum, month) =>
        sum +
        month.transactions.filter(
          (tx) => tx.transferLikelihood === 'HIGH' || tx.transferLikelihood === 'MEDIUM'
        ).length,
      0
    );
    const creditFlagged = localCreditMonths.reduce(
      (sum, month) =>
        sum +
        month.transactions.filter(
          (tx) => tx.transferLikelihood === 'HIGH' || tx.transferLikelihood === 'MEDIUM'
        ).length,
      0
    );
    return debitFlagged + creditFlagged;
  }, [localDebitMonths, localCreditMonths]);

  return (
    <div className='flex h-full min-h-0 flex-col'>
      {/* Transfer Likelihood Warning Banner */}
      {flaggedCount > 0 && (
        <div className='mb-4 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950'>
          <span className='mt-0.5 flex-shrink-0 text-lg text-yellow-600 dark:text-yellow-400'>↔</span>
          <p className='text-sm text-yellow-800 dark:text-yellow-200'>
            <span className='font-medium dark:text-yellow-100'>
              {flaggedCount} transaction{flaggedCount > 1 ? 's' : ''}
            </span>{' '}
            look like possible transfers. Review them before confirming — or continue and resolve any unmatched transfers in the Transfers
            tab after import.
          </p>
        </div>
      )}

      <div className='mb-4 flex flex-shrink-0 gap-4 border-b'>
        <button
          onClick={() => setActiveTab('debits')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'debits'
              ? 'border-b-2 border-teal-500 text-teal-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Expenses ({totalDebitCount})
        </button>
        <button
          onClick={() => setActiveTab('credits')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'credits'
              ? 'border-b-2 border-teal-500 text-teal-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Income / Credits ({nonExcludedCreditCount})
        </button>
        {excludedCount > 0 && (
          <button
            onClick={() => setActiveTab('excluded')}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === 'excluded'
                ? 'border-b-2 border-teal-500 text-teal-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Excluded ({excludedCount})
          </button>
        )}
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {activeTab === 'debits' && (
          <TransactionReviewTable
            months={localDebitMonths as SharedClassifiedMonth[]}
            categories={categories}
            llmModel={llmModel}
            onUpdateMonths={(months) => setLocalDebitMonths(months as ClassifiedMonth[])}
          />
        )}
        {activeTab === 'credits' && (
          <CreditReviewPanel
            months={localCreditMonths}
            incomeSourceLabels={incomeSourceLabels}
            onUpdate={setLocalCreditMonths}
            filterMode="income"
          />
        )}
        {activeTab === 'excluded' && (
          <CreditReviewPanel
            months={localCreditMonths}
            incomeSourceLabels={incomeSourceLabels}
            onUpdate={setLocalCreditMonths}
            filterMode="excluded"
          />
        )}
      </div>

      <div className='flex flex-shrink-0 justify-end border-t pt-4'>
        <button
          onClick={() => void onConfirm(localDebitMonths, localCreditMonths)}
          disabled={isConfirming}
          className='rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50'
        >
          {isConfirming ? 'Saving…' : 'Confirm & Import All'}
        </button>
      </div>
    </div>
  );
}


