'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowLeft, ExternalLink } from 'lucide-react';
import { NumericFormat } from 'react-number-format';

import MONTHS_MAP from '@/constants/map';
import { trpc } from '@/server/trpc/client';

interface CategoryFilteredLedgerProps {
  category: string;  // Category name (for display and tRPC query)
  categoryId: string; // Category ID (for URL parameter)
  month: number;
  year: number;
}

function formatMonthLabel(month: number) {
  const monthName = MONTHS_MAP.get(month);
  if (!monthName) return `Month ${month}`;

  return monthName.charAt(0) + monthName.slice(1).toLowerCase();
}

function formatCategoryLabel(category: string) {
  // Decode if it's still URL-encoded
  let decodedCategory = category;
  try {
    // Check if the string looks encoded (contains % followed by hex)
    if (/%[0-9A-F]{2}/i.test(category)) {
      decodedCategory = decodeURIComponent(category);
    }
  } catch {
    // If decode fails, use original
    decodedCategory = category;
  }

  return decodedCategory
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function CategoryFilteredLedger({ category, categoryId, month, year }: CategoryFilteredLedgerProps) {
  const effectiveYear = year ?? new Date().getFullYear();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? effectiveYear - 1 : effectiveYear;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? effectiveYear + 1 : effectiveYear;

  const prevHref = `/cashflow/transactions?category=${encodeURIComponent(category)}&month=${prevMonth}&year=${prevYear}`;
  const nextHref = `/cashflow/transactions?category=${encodeURIComponent(category)}&month=${nextMonth}&year=${nextYear}`;

  const { data, isLoading, error } = trpc.categoryTransactions.getByCategory.useQuery(
    {
      category,
      month,
      year: effectiveYear,
      limit: 100,
      offset: 0,
    },
    {
      enabled: !!category && month > 0,
    },
  );

  const monthName = formatMonthLabel(month);
  const categoryName = formatCategoryLabel(data?.category ?? category);

  return (
    <div>
      {/* Breadcrumb + escape hatch */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/cashflow/expense"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Expense Management
        </Link>
        <Link
          href={`/cashflow/transactions?view=ledger&category=${encodeURIComponent(categoryId)}&month=${month}&year=${effectiveYear}`}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-teal-400 hover:text-foreground dark:border-border dark:text-muted-foreground dark:hover:border-teal-500 dark:hover:text-foreground"
        >
          View in Transactions
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Title + summary stats */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground dark:text-foreground">
          {categoryName}
        </h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground dark:text-muted-foreground">
          {!isLoading && data && (
            <>
              <div>
                <span className="font-medium text-foreground dark:text-foreground">{data.total}</span>{' '}
                transaction{data.total !== 1 ? 's' : ''}
              </div>
              <div>
                Total:{' '}
                <span className="font-medium text-foreground dark:text-foreground">
                  <NumericFormat prefix="$" displayType="text" thousandSeparator decimalScale={2} fixedDecimalScale value={data.totalAmount.toFixed(2)} />
                </span>
              </div>
              <div>
                Average:{' '}
                <span className="font-medium text-foreground dark:text-foreground">
                  <NumericFormat prefix="$" displayType="text" thousandSeparator decimalScale={2} fixedDecimalScale value={data.averageAmount.toFixed(2)} />
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Month navigation */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <Link
          href={prevHref}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-teal-400 hover:text-foreground dark:border-border dark:text-muted-foreground dark:hover:border-teal-500 dark:hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {formatMonthLabel(prevMonth)} {prevYear !== effectiveYear ? prevYear : ''}
        </Link>
        <span className="min-w-[120px] text-center text-sm font-semibold text-foreground dark:text-foreground">
          {monthName} {effectiveYear}
        </span>
        <Link
          href={nextHref}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-teal-400 hover:text-foreground dark:border-border dark:text-muted-foreground dark:hover:border-teal-500 dark:hover:text-foreground"
        >
          {formatMonthLabel(nextMonth)} {nextYear !== effectiveYear ? nextYear : ''}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Loading / error / empty states */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-teal-500 dark:border-gray-700 dark:border-t-teal-400" />
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">Loading transactions...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 dark:border-destructive/50 dark:bg-destructive/10">
          <p className="text-sm text-destructive dark:text-destructive">
            Error loading transactions: {error.message}
          </p>
        </div>
      )}

      {!isLoading && !error && data && data.transactions.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center dark:border-border dark:bg-muted/50">
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            No transactions for this category in {monthName} {effectiveYear}.
          </p>
        </div>
      )}

      {!isLoading && !error && data && data.transactions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border dark:border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted dark:bg-muted">
              <tr className="border-b border-border dark:border-border">
                <th className="cursor-default select-none px-4 py-3 text-left font-semibold text-foreground dark:text-foreground">
                  Date
                </th>
                <th className="cursor-default select-none px-4 py-3 text-left font-semibold text-foreground dark:text-foreground">
                  Description
                </th>
                <th className="cursor-default select-none px-4 py-3 text-right font-semibold text-foreground dark:text-foreground">
                  Amount
                </th>
                <th className="cursor-default select-none px-4 py-3 text-left font-semibold text-foreground dark:text-foreground">
                  Account
                </th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border transition-colors hover:bg-muted/50 dark:border-border dark:hover:bg-muted/50">
                  <td className="px-4 py-3 text-foreground dark:text-foreground">{tx.date}</td>
                  <td className="px-4 py-3 text-foreground dark:text-foreground">{tx.description}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground dark:text-foreground">
                    <NumericFormat prefix="$" displayType="text" thousandSeparator decimalScale={2} fixedDecimalScale value={tx.amount.toFixed(2)} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground dark:text-muted-foreground">
                    {tx.bankAccountName || 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
