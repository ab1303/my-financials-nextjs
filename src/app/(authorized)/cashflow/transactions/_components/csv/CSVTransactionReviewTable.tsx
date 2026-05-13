'use client';

import { useMemo, useState } from 'react';
import TransactionReviewTable, { type ClassifiedMonth as SharedClassifiedMonth } from '@/components/csv-import/TransactionReviewTable';
import type { ClassifiedCreditMonth, ClassifiedCreditTransaction } from '@/server/services/ai-import/_types';
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
}: {
  months: ClassifiedCreditMonth[];
  incomeSourceLabels: string[];
  onUpdate: (months: ClassifiedCreditMonth[]) => void;
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

  if (months.length === 0) {
    return <p className='py-4 text-sm text-gray-500'>No credit transactions found.</p>;
  }

  return (
    <div className='space-y-6'>
      {months.map((month, monthIdx) => (
        <div key={month.month}>
          <h3 className='mb-2 text-sm font-semibold text-gray-700'>{month.month}</h3>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='border-b border-gray-200'>
                <th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>Date</th>
                <th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>Description</th>
                <th className='py-2 pr-4 text-right text-xs font-medium text-gray-500'>Amount</th>
                <th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>LLM Suggested</th>
                <th className='py-2 text-left text-xs font-medium text-gray-500'>Your Classification</th>
              </tr>
            </thead>
            <tbody>
              {month.transactions.map((tx, txIdx) => {
                const isExcluded = tx.confirmedCategory === 'Excluded' || tx.confirmedCategory === 'Transfer';
                return (
                  <tr key={tx.id} className={`border-b border-gray-100 ${tx.overridden ? 'bg-amber-50' : ''}`}>
                    <td className={`py-2 pr-4 ${isExcluded ? 'line-through text-gray-400' : 'text-gray-600'}`}>{tx.date}</td>
                    <td className={`max-w-[200px] truncate py-2 pr-4 ${isExcluded ? 'line-through text-gray-400' : 'text-gray-900'}`}>{tx.description}</td>
                    <td className={`py-2 pr-4 text-right ${isExcluded ? 'line-through text-gray-400' : 'text-gray-900'}`}>${tx.amount.toFixed(2)}</td>
                    <td className='py-2 pr-4 text-xs text-gray-500'>{tx.llmCategory}</td>
                    <td className='py-2'>
                      <select
                        value={tx.confirmedCategory}
                        onChange={(e) => handleCategoryChange(monthIdx, txIdx, e.target.value)}
                        className='w-full rounded border border-gray-300 px-2 py-1 text-xs'
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
  const [activeTab, setActiveTab] = useState<'debits' | 'credits'>('debits');
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

  return (
    <div className='flex h-full min-h-0 flex-col'>
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
          Income / Credits ({totalCreditCount})
          {excludedCount > 0 && <span className='ml-2 text-xs text-gray-400'>{excludedCount} excluded</span>}
        </button>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {activeTab === 'debits' && (
          <TransactionReviewTable
            months={localDebitMonths as SharedClassifiedMonth[]}
            categories={categories}
            llmModel={llmModel}
            onConfirm={async (updatedMonths) => {
              setLocalDebitMonths(updatedMonths as ClassifiedMonth[]);
            }}
            isConfirming={false}
            onUpdateMonths={setLocalDebitMonths as React.Dispatch<React.SetStateAction<ClassifiedMonth[]>>}
          />
        )}
        {activeTab === 'credits' && (
          <CreditReviewPanel
            months={localCreditMonths}
            incomeSourceLabels={incomeSourceLabels}
            onUpdate={setLocalCreditMonths}
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
