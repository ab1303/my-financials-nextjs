import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardSummaryResponse } from '@/server/models/dashboard';

interface Props {
  transactions: DashboardSummaryResponse['recentTransactions'];
}

/**
 * RecentTransactionsWidget - Server Component
 * Displays the last 5 confirmed transactions in a feed format
 * Shows date, truncated description, category badge, and formatted amount
 * CREDIT amounts are green with + prefix, DEBIT amounts are red with - prefix
 * Includes link to full transactions page
 */
export function RecentTransactionsWidget({ transactions }: Props) {
  const formatAUD = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const truncateDescription = (desc: string, maxLength: number = 40) => {
    return desc.length > maxLength ? desc.substring(0, maxLength) + '…' : desc;
  };

  // Empty state
  if (transactions.length === 0) {
    return (
      <Card className='col-span-full dark:border-slate-700'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='mb-3 text-sm text-muted-foreground'>
            No transactions yet
          </p>
          <Link
            href='/cashflow/transactions'
            className='inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline'
          >
            View all transactions
            <ArrowRight className='h-3 w-3' />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='col-span-full dark:border-slate-700'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {/* Transaction List */}
        <div className='space-y-2'>
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className='flex items-center justify-between gap-2 rounded-sm border border-border/50 p-2 dark:border-slate-700/50'
            >
              {/* Left: Date, Description, Category */}
              <div className='flex-1 space-y-1'>
                <div className='flex items-center gap-2'>
                  <p className='text-xs text-muted-foreground'>
                    {formatDate(tx.date)}
                  </p>
                  <p className='text-sm font-medium text-foreground'>
                    {truncateDescription(tx.description)}
                  </p>
                </div>
                <div className='flex items-center gap-1'>
                  <span className='inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground dark:bg-slate-700'>
                    {tx.category}
                  </span>
                  {tx.bankAccountName && (
                    <span className='text-xs text-muted-foreground'>
                      {tx.bankAccountName}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Amount */}
              <div className='flex-shrink-0'>
                <p
                  className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                    tx.type === 'CREDIT'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {tx.type === 'CREDIT' ? '+' : '-'}
                  {formatAUD(tx.amount)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <div className='border-t border-border pt-3 dark:border-slate-700'>
          <Link
            href='/cashflow/transactions'
            className='inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline'
          >
            View all transactions
            <ArrowRight className='h-3 w-3' />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
