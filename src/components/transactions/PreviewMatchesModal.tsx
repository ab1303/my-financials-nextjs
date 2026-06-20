'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PreviewMatch {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category: string;
  status: string;
}

interface PreviewMatchesModalProps {
  open: boolean;
  matches: PreviewMatch[];
  totalCount: number;
  matchScope: 'recent' | 'all';
  onMatchScopeChange: (scope: 'recent' | 'all') => void;
  onCancel: () => void;
  onApply: () => void;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}

export function PreviewMatchesModal({
  open,
  matches,
  totalCount,
  matchScope,
  onMatchScopeChange,
  onCancel,
  onApply,
  isLoading = false,
}: PreviewMatchesModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open) return null;
  if (!mounted) return null;

  const displayCount = Math.min(matches.length, 5);
  const hasMore = totalCount > displayCount;

  return createPortal(
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900'>
        {/* Header */}
        <div className='border-b border-gray-200 px-6 py-4 dark:border-gray-700'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Preview Matching Transactions
          </h2>
          <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
            Found {totalCount} similar transaction{totalCount !== 1 ? 's' : ''}
            {hasMore && ` — showing first ${displayCount}`}
          </p>
        </div>

        {/* Scope Toggle */}
        <div className='border-b border-gray-200 px-6 py-3 dark:border-gray-700'>
          <div className='flex items-center gap-4'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              Scope:
            </span>
            <div className='flex gap-2'>
              <button
                onClick={() => onMatchScopeChange('recent')}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  matchScope === 'recent'
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                Recent 90 days
              </button>
              <button
                onClick={() => onMatchScopeChange('all')}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  matchScope === 'all'
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                All time
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className='overflow-auto'>
          {matches.length === 0 ? (
            <div className='px-6 py-8 text-center'>
              <p className='text-gray-600 dark:text-gray-400'>
                No matching transactions found
              </p>
            </div>
          ) : (
            <table className='w-full'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr>
                  <th className='px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300'>
                    Date
                  </th>
                  <th className='px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300'>
                    Description
                  </th>
                  <th className='px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300'>
                    Amount
                  </th>
                  <th className='px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300'>
                    Current Category
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {matches.map((match) => (
                  <tr
                    key={match.id}
                    className='hover:bg-gray-50 dark:hover:bg-gray-800'
                  >
                    <td className='whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300'>
                      {match.date}
                    </td>
                    <td className='px-4 py-3 text-sm text-gray-900 dark:text-white'>
                      <span className='truncate' title={match.description}>
                        {match.description}
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums ${
                        match.type === 'DEBIT'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {formatCurrency(Math.abs(match.amount))}
                    </td>
                    <td className='px-4 py-3 text-sm text-gray-700 dark:text-gray-300'>
                      {match.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className='border-t border-gray-200 flex justify-end gap-3 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800'>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className='rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700'
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={isLoading || matches.length === 0}
            className='rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-700 dark:hover:bg-teal-600'
          >
            {isLoading ? 'Applying...' : 'Apply to All'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}