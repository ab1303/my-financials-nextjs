'use client';

import { format } from 'date-fns';

type AssetSummaryCardsProps = {
  latestNetWorth: number;
  latestCashTotal: number;
  latestStockTotal: number;
  latestCashDate: string | null;
  latestStockDate: string | null;
  isLoading: boolean;
};

const formatAudCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDisplayDate = (value: string | null, fallback: string) =>
  value ? format(new Date(value), 'dd MMM yyyy') : fallback;

export default function AssetSummaryCards({
  latestNetWorth,
  latestCashTotal,
  latestStockTotal,
  latestCashDate,
  latestStockDate,
  isLoading,
}: AssetSummaryCardsProps) {
  const cardClassName =
    'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900';

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        {[1, 2, 3].map((key) => (
          <div
            key={key}
            className={`${cardClassName} animate-pulse bg-gray-100 dark:bg-gray-800`}
          >
            <div className='h-4 w-24 rounded bg-gray-200 dark:bg-gray-700' />
            <div className='mt-4 h-8 w-36 rounded bg-gray-200 dark:bg-gray-700' />
            <div className='mt-3 h-4 w-32 rounded bg-gray-200 dark:bg-gray-700' />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
      <article className={cardClassName}>
        <p className='text-sm font-medium text-gray-600 dark:text-gray-300'>
          Total Assets (AUD)
        </p>
        <p className='mt-3 text-2xl font-semibold text-purple-700 dark:text-purple-400'>
          {formatAudCurrency(latestNetWorth)}
        </p>
        <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
          As at {formatDisplayDate(latestCashDate, 'No cash snapshot yet')}
        </p>
      </article>

      <article className={cardClassName}>
        <p className='text-sm font-medium text-gray-600 dark:text-gray-300'>Cash</p>
        <p className='mt-3 text-2xl font-semibold text-blue-700 dark:text-blue-400'>
          {formatAudCurrency(latestCashTotal)}
        </p>
        <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
          As at {formatDisplayDate(latestCashDate, 'No cash snapshot yet')}
        </p>
      </article>

      <article className={cardClassName}>
        <p className='text-sm font-medium text-gray-600 dark:text-gray-300'>
          Stocks (AUD equiv.)
        </p>
        <p className='mt-3 text-2xl font-semibold text-green-700 dark:text-green-400'>
          {formatAudCurrency(latestStockTotal)}
        </p>
        <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
          As at {formatDisplayDate(latestStockDate, 'No stock snapshot yet')}
        </p>
      </article>
    </div>
  );
}
