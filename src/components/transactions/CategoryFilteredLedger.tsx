'use client';

import { NumericFormat } from 'react-number-format';

import MONTHS_MAP from '@/constants/map';
import { trpc } from '@/server/trpc/client';

interface CategoryFilteredLedgerProps {
  category: string;
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

export function CategoryFilteredLedger({ category, month, year }: CategoryFilteredLedgerProps) {
  const effectiveYear = year ?? new Date().getFullYear();

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

  if (isLoading) {
    return (
      <div className='flex justify-center py-12'>
        <div className='text-center'>
          <div className='mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-teal-500 dark:border-gray-700 dark:border-t-teal-400' />
          <p className='text-sm text-muted-foreground dark:text-muted-foreground'>Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4 dark:border-destructive/50 dark:bg-destructive/10'>
        <p className='text-sm text-destructive dark:text-destructive'>
          Error loading transactions: {error.message}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='rounded-lg border border-border bg-muted/50 p-4 dark:border-border dark:bg-muted/50'>
        <p className='text-sm text-muted-foreground dark:text-muted-foreground'>No transactions found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className='mb-6'>
        <h2 className='text-2xl font-bold text-foreground dark:text-foreground'>
          {categoryName} – {monthName} {effectiveYear}
        </h2>
        <div className='mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground dark:text-muted-foreground'>
          <div>
            <span className='font-medium text-foreground dark:text-foreground'>{data.total}</span> transaction
            {data.total !== 1 ? 's' : ''}
          </div>
          <div>
            Total:{' '}
            <span className='font-medium text-foreground dark:text-foreground'>
              <NumericFormat prefix='$' displayType='text' thousandSeparator decimalScale={2} fixedDecimalScale value={data.totalAmount.toFixed(2)} />
            </span>
          </div>
          <div>
            Average:{' '}
            <span className='font-medium text-foreground dark:text-foreground'>
              <NumericFormat prefix='$' displayType='text' thousandSeparator decimalScale={2} fixedDecimalScale value={data.averageAmount.toFixed(2)} />
            </span>
          </div>
        </div>
      </div>

      {data.transactions.length === 0 ? (
        <div className='rounded-lg border border-border bg-muted/50 p-8 text-center dark:border-border dark:bg-muted/50'>
          <p className='text-sm text-muted-foreground dark:text-muted-foreground'>
            No transactions for this category and month.
          </p>
        </div>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border dark:border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted dark:bg-muted'>
              <tr className='border-b border-border dark:border-border'>
                <th className='cursor-default select-none px-4 py-3 text-left font-semibold text-foreground dark:text-foreground'>
                  Date
                </th>
                <th className='cursor-default select-none px-4 py-3 text-left font-semibold text-foreground dark:text-foreground'>
                  Description
                </th>
                <th className='cursor-default select-none px-4 py-3 text-right font-semibold text-foreground dark:text-foreground'>
                  Amount
                </th>
                <th className='cursor-default select-none px-4 py-3 text-left font-semibold text-foreground dark:text-foreground'>
                  Account
                </th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <tr key={tx.id} className='border-b border-border transition-colors hover:bg-muted/50 dark:border-border dark:hover:bg-muted/50'>
                  <td className='px-4 py-3 text-foreground dark:text-foreground'>{tx.date}</td>
                  <td className='px-4 py-3 text-foreground dark:text-foreground'>{tx.description}</td>
                  <td className='px-4 py-3 text-right font-medium text-foreground dark:text-foreground'>
                    <NumericFormat prefix='$' displayType='text' thousandSeparator decimalScale={2} fixedDecimalScale value={tx.amount.toFixed(2)} />
                  </td>
                  <td className='px-4 py-3 text-sm text-muted-foreground dark:text-muted-foreground'>
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
