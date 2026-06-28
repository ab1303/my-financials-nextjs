'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NumericFormat } from 'react-number-format';

import { trpc } from '@/server/trpc/client';

export type DrillDownFilter = {
  type: 'category' | 'source' | 'month';
  categoryName?: string;    // For category filter
  source?: string;          // For source filter
  month?: number;           // For month filter
  year: number;             // Always required
  label: string;            // Human-readable: "Groceries", "Salary income", "July 2024"
  transactionType: 'DEBIT' | 'CREDIT'; // DEBIT for expenses, CREDIT for income
};

type AnalyticsDrillDownDrawerProps = {
  open: boolean;
  onClose: () => void;
  filter: DrillDownFilter | null;
};

export default function AnalyticsDrillDownDrawer({
  open,
  onClose,
  filter,
}: AnalyticsDrillDownDrawerProps) {
  const [mounted, setMounted] = useState(false);

  // Handle Escape key press
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Mount client-side to avoid hydration mismatch
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Fetch transactions for the drill-down filter
  const query = trpc.categoryTransactions.getForPeriod.useQuery(
    {
      category: filter?.type === 'category' ? filter.categoryName : undefined,
      source: filter?.type === 'source' ? filter.source : undefined,
      month: filter?.type === 'month' ? filter.month : undefined,
      year: filter?.year ?? new Date().getFullYear(),
      type: filter?.transactionType ?? 'DEBIT',
      limit: 100,
      offset: 0,
    },
    { enabled: mounted && open && filter !== null }
  );

  if (!mounted || !open) return null;

  // Build "View all in Transactions" URL
  let viewAllUrl = '/cashflow/transactions?';
  if (filter?.type === 'category' && filter.categoryName) {
    viewAllUrl += `category=${encodeURIComponent(filter.categoryName)}`;
  } else if (filter?.type === 'source' && filter.source) {
    viewAllUrl += `source=${encodeURIComponent(filter.source)}`;
  } else if (filter?.type === 'month' && filter.month) {
    viewAllUrl += `month=${filter.month}&year=${filter.year}`;
  } else {
    viewAllUrl += `year=${filter?.year}`;
  }

  const drawerContent = (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right-side drawer panel */}
      <div className="fixed right-0 top-0 h-full z-50 w-full sm:w-[480px] bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {filter?.label ?? 'Transactions'}
            </h2>
            {query.data && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {query.data.total} transaction{query.data.total !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 ml-4 shrink-0"
            aria-label="Close drawer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount summary */}
        {query.data && (
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              <NumericFormat
                value={query.data.totalAmount}
                displayType="text"
                thousandSeparator=","
                prefix="$"
                decimalScale={2}
                fixedDecimalScale
              />
            </p>
          </div>
        )}

        {/* Body — Transaction list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {query.isLoading && (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading transactions…</p>
            </div>
          )}

          {query.isError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">
                Failed to load transactions. Please try again.
              </p>
            </div>
          )}

          {query.data && query.data.transactions.length === 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
              No transactions found for this period.
            </p>
          )}

          {query.data && query.data.transactions.length > 0 && (
            <div className="space-y-3">
              {query.data.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {tx.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(tx.date).toLocaleDateString('en-AU')}
                      {tx.bankAccountName && (
                        <>
                          {' '}·{' '}
                          <span className="text-gray-600 dark:text-gray-300">{tx.bankAccountName}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      <NumericFormat
                        value={tx.amount}
                        displayType="text"
                        thousandSeparator=","
                        prefix="$"
                        decimalScale={2}
                        fixedDecimalScale
                      />
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {tx.source}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — View all link */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 shrink-0">
          <Link
            href={viewAllUrl}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            View all in Transactions
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
