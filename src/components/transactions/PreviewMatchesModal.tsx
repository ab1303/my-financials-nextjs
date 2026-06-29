'use client';

import { useState } from 'react';
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
  hasMore?: boolean;
  isLoadingMore?: boolean;
  matchScope: 'recent' | 'all';
  onMatchScopeChange: (scope: 'recent' | 'all') => void;
  onCancel: () => void;
  onApply: (selectedIds: string[]) => void;
  onLoadMore?: () => void;
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
  hasMore = false,
  isLoadingMore = false,
  matchScope,
  onMatchScopeChange,
  onCancel,
  onApply,
  onLoadMore,
  isLoading = false,
}: PreviewMatchesModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const loadedCount = matches.length;

  const handleCheckboxChange = (matchId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(matchId)) {
      newSelected.delete(matchId);
    } else {
      newSelected.add(matchId);
    }
    setSelectedIds(newSelected);
  };

  const handleApply = () => {
    onApply(Array.from(selectedIds));
  };

  return createPortal(
    <div className='fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4'>
      <div className='mx-auto flex min-h-full w-[min(96vw,72rem)] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900'>
        {/* Header */}
        <div className='border-b border-gray-200 px-6 py-4 dark:border-gray-700'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Preview Matching Transactions
          </h2>
          <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
            Found {totalCount} similar transaction{totalCount !== 1 ? 's' : ''}
            {' — '}
            showing {loadedCount} loaded
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
        <div className='min-h-0 flex-1 overflow-auto'>
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
                  <th className='w-12 px-4 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300'>
                    Select
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
                    <td className='w-12 px-4 py-3 text-center'>
                      <input
                        type='checkbox'
                        checked={selectedIds.has(match.id)}
                        onChange={() => handleCheckboxChange(match.id)}
                        aria-label={`select-${match.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className='border-t border-gray-200 flex justify-end gap-3 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800'>
          {hasMore && onLoadMore && (
            <button
              onClick={onLoadMore}
              disabled={isLoading || isLoadingMore}
              className='mr-auto rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            >
              {isLoadingMore ? 'Loading more...' : 'Load more'}
            </button>
          )}
          <button
            onClick={onCancel}
            disabled={isLoading}
            className='rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700'
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isLoading || selectedIds.size === 0}
            className='rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-700 dark:hover:bg-teal-600'
          >
            {isLoading
              ? 'Applying...'
              : `Apply to ${selectedIds.size} ${selectedIds.size === 1 ? 'row' : 'rows'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
