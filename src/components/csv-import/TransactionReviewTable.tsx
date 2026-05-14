'use client';

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type {
  ClassifiedTransaction,
} from '@/server/services/ai-import/_types';

/**
 * Known Australian brand tokens for merchant detection
 */
const KNOWN_BRAND_TOKENS = new Set([
  'WOOLWORTHS',
  'COLES',
  'ALDI',
  'IGA',
  'HARRIS',
  'NETFLIX',
  'SPOTIFY',
  'DISNEY',
  'STAN',
  'APPLE',
  'AMAZON',
  'UBER',
  'DOORDASH',
  'MENULOG',
  'CHEMIST',
  'PRICELINE',
  'TRANSPORT',
  'OPAL',
  'PAYPAL',
  'GOOGLE',
  'MICROSOFT',
]);

/**
 * Detect if merchant description looks unknown/suspicious
 */
export function isLikelyUnknownMerchant(description: string): boolean {
  const words = description.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  if (description !== description.toUpperCase()) return false;
  return !KNOWN_BRAND_TOKENS.has(words[0]?.toUpperCase() ?? '');
}

/**
 * Month of transactions with usage statistics
 */
export interface ClassifiedMonth {
  month: string;
  transactions: ClassifiedTransaction[];
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Component props
 */
export interface TransactionReviewTableProps {
  months: ClassifiedMonth[];
  categories: Array<{ id: string; name: string }>;
  llmModel?: string;
  onUpdateMonths?: (months: ClassifiedMonth[]) => void;
}

// GPT-4o-mini: $0.15/1M input, $0.60/1M output tokens
// Conservative: treat all tokens as input price for a safe ceiling estimate
function estimateCostUSD(totalTokens: number, model: string): string {
  const pricePerMillion = model.includes('gpt-4o-mini') ? 0.60 : model.includes('gpt-4o') ? 15.0 : 0.60;
  const cost = (totalTokens / 1_000_000) * pricePerMillion;
  return cost < 0.01 ? '<$0.01' : `~$${cost.toFixed(3)}`;
}

export default function TransactionReviewTable({
  months: initialMonths,
  categories,
  llmModel = 'gpt-4o-mini',
  onUpdateMonths,
}: TransactionReviewTableProps) {
  const [months, setMonths] = useState<ClassifiedMonth[]>(
    initialMonths.map((m) => ({
      ...m,
      transactions: m.transactions.map((t) => ({ ...t })),
    })),
  );
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    new Set(initialMonths.map((m) => m.month)),
  );

  // Sort state (global for all months)
  const [sortColumn, setSortColumn] = useState<'date' | 'description' | 'amount' | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((col: 'date' | 'description' | 'amount') => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'date' ? 'desc' : 'asc');
    }
  }, [sortColumn]);

  const handleToggleMonth = useCallback((month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  }, []);

  const handleCategoryChange = useCallback(
    (monthIdx: number, txIdx: number, newCategory: string) => {
      const next = months.map((m, mi) => {
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
      setMonths(next);
      onUpdateMonths?.(next);
    },
    [months, onUpdateMonths],
  );

  const totalOverrides = months.reduce(
    (sum, m) => sum + m.transactions.filter((t) => t.overridden).length,
    0,
  );

  const totalUsage = {
    promptTokens: months.reduce((sum, m) => sum + m.totalUsage.promptTokens, 0),
    completionTokens: months.reduce((sum, m) => sum + m.totalUsage.completionTokens, 0),
    totalTokens: months.reduce((sum, m) => sum + m.totalUsage.totalTokens, 0),
  };

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='mb-4 flex flex-shrink-0 items-start justify-between'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Review Classifications
          </h2>
          <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
            {months.reduce((sum, m) => sum + m.transactions.length, 0)} transactions •{' '}
            {totalOverrides} changes applied
          </p>
        </div>
        <div className='space-y-0.5 text-right text-xs text-gray-500 dark:text-gray-400'>
          <p className='font-medium text-gray-700 dark:text-gray-300'>{llmModel}</p>
          <p>{totalUsage.totalTokens.toLocaleString()} tokens used</p>
          <p className='text-teal-600 dark:text-teal-400'>
            Est. cost: {estimateCostUSD(totalUsage.totalTokens, llmModel)}
          </p>
        </div>
      </div>

      <div className='min-h-0 flex-1 space-y-4 overflow-y-auto pr-1'>
        {months.map((month, monthIdx) => (
          <div
            key={month.month}
            className='overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700'
          >
            <button
              onClick={() => handleToggleMonth(month.month)}
              className='flex w-full items-center justify-between bg-gray-50 px-4 py-3 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'
            >
              <div className='flex items-center space-x-2'>
                {expandedMonths.has(month.month) ? (
                  <ChevronUp className='h-4 w-4 text-gray-600 dark:text-gray-400' />
                ) : (
                  <ChevronDown className='h-4 w-4 text-gray-600 dark:text-gray-400' />
                )}
                <span className='font-medium text-gray-900 dark:text-white'>{month.month}</span>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  ({month.transactions.length} transactions)
                </span>
              </div>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                {month.transactions.filter((t) => t.overridden).length} changes
              </span>
            </button>

            {expandedMonths.has(month.month) && (
              <div className='max-h-96 overflow-auto'>
                <table className='w-full min-w-[600px]'>
                  <thead className='sticky top-0 z-10 border-b bg-gray-100 dark:border-gray-700 dark:bg-gray-800'>
                    <tr>
                      <th
                        className='w-28 px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-700'
                        onClick={() => handleSort('date')}
                      >
                        <span className='inline-flex items-center gap-1'>
                          Date
                          {sortColumn === 'date' ? (
                            sortDirection === 'asc' ? <ArrowUp className='inline h-3 w-3' /> : <ArrowDown className='inline h-3 w-3' />
                          ) : (
                            <ArrowUpDown className='inline h-3 w-3 text-gray-400' />
                          )}
                        </span>
                      </th>
                      <th
                        className='px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-700'
                        onClick={() => handleSort('description')}
                      >
                        <span className='inline-flex items-center gap-1'>
                          Description
                          {sortColumn === 'description' ? (
                            sortDirection === 'asc' ? <ArrowUp className='inline h-3 w-3' /> : <ArrowDown className='inline h-3 w-3' />
                          ) : (
                            <ArrowUpDown className='inline h-3 w-3 text-gray-400' />
                          )}
                        </span>
                      </th>
                      <th
                        className='w-24 px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-700'
                        onClick={() => handleSort('amount')}
                      >
                        <span className='inline-flex items-center gap-1'>
                          Amount
                          {sortColumn === 'amount' ? (
                            sortDirection === 'asc' ? <ArrowUp className='inline h-3 w-3' /> : <ArrowDown className='inline h-3 w-3' />
                          ) : (
                            <ArrowUpDown className='inline h-3 w-3 text-gray-400' />
                          )}
                        </span>
                      </th>
                      <th className='w-36 px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300'>
                        LLM Suggested
                      </th>
                      <th className='w-44 px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300'>
                        Your Category
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Map original index for stable handleCategoryChange
                      const txsWithIdx = month.transactions.map((tx, idx) => ({ tx, idx }));
                      // Sort logic
                      const sorted = [...txsWithIdx].sort((a, b) => {
                        if (sortColumn === 'date') {
                          return sortDirection === 'asc'
                            ? a.tx.date.localeCompare(b.tx.date)
                            : b.tx.date.localeCompare(a.tx.date);
                        } else if (sortColumn === 'description') {
                          return sortDirection === 'asc'
                            ? a.tx.description.localeCompare(b.tx.description, undefined, { sensitivity: 'base' })
                            : b.tx.description.localeCompare(a.tx.description, undefined, { sensitivity: 'base' });
                        } else if (sortColumn === 'amount') {
                          return sortDirection === 'asc'
                            ? a.tx.amount - b.tx.amount
                            : b.tx.amount - a.tx.amount;
                        }
                        return 0;
                      });
                      return sorted.map(({ tx, idx }) => (
                        <tr
                          key={tx.id}
                          className={`border-b transition-colors dark:border-gray-700 ${
                            tx.overridden
                              ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                        <td className='px-4 py-3 text-sm text-gray-900 dark:text-gray-200'>
                          {tx.date}
                        </td>
                        <td className='max-w-[240px] px-4 py-3 text-sm text-gray-900 dark:text-gray-200'>
                          <div className='flex items-center space-x-2'>
                            {isLikelyUnknownMerchant(tx.description) && (
                              <AlertCircle className='h-4 w-4 flex-shrink-0 text-amber-500' />
                            )}
                            <span className='truncate font-medium' title={tx.description}>
                              {tx.description}
                            </span>
                          </div>
                        </td>
                        <td className='px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-200'>
                          ${tx.amount.toFixed(2)}
                        </td>
                        <td className='px-4 py-3 text-sm text-gray-600 dark:text-gray-400'>
                          {tx.llmCategory}
                        </td>
                        <td className='px-4 py-3 text-sm'>
                          <select
                            value={tx.confirmedCategory}
                            onChange={(e) => handleCategoryChange(monthIdx, idx, e.target.value)}
                            className='w-full min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                          >
                            {!categories.some((c) => c.name === tx.confirmedCategory) && (
                              <option value={tx.confirmedCategory}>{tx.confirmedCategory}</option>
                            )}
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>


    </div>
  );
}
