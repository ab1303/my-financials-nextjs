import { TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardSummaryResponse } from '@/server/models/dashboard';

interface Props {
  cashflowYTD: DashboardSummaryResponse['cashflowYTD'];
}

/**
 * CashflowPulseCard - Server Component
 * Displays fiscal year income, expenses, net cashflow, and savings rate
 * Shows a progress bar for savings rate (0-100%, purple fill)
 * Handles negative cashflow by showing red color and 0% progress bar
 */
export function CashflowPulseCard({ cashflowYTD }: Props) {
  const formatAUD = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  // Empty state: no fiscal year data
  if (!cashflowYTD) {
    return (
      <Card className='col-span-full dark:border-slate-700'>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
            <TrendingUp className='h-4 w-4 text-primary' aria-hidden='true' />
            Cashflow Pulse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No fiscal year data</p>
        </CardContent>
      </Card>
    );
  }

  const {
    calendarYearDescription,
    totalIncome,
    totalExpenses,
    netCashflow,
    savingsRate,
  } = cashflowYTD;

  // Determine if cashflow is positive
  const isPositive = netCashflow >= 0;

  // Clamp savings rate to 0-100 for progress bar display
  const displaySavingsRate = Math.max(0, Math.min(100, savingsRate));

  return (
    <Card className='col-span-full dark:border-slate-700'>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center justify-between text-sm font-medium'>
          <span className='flex items-center gap-2 text-muted-foreground'>
            <TrendingUp className='h-4 w-4 text-primary' aria-hidden='true' />
            Cashflow Pulse
          </span>
          <span className='text-xs font-normal text-muted-foreground'>
            {calendarYearDescription}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Income, Expenses, Net Row */}
        <div className='grid grid-cols-3 gap-4'>
          {/* Income */}
          <div>
            <p className='text-xs text-muted-foreground'>Income</p>
            <p className='text-sm font-semibold tabular-nums text-green-600 dark:text-green-400'>
              +{formatAUD(totalIncome)}
            </p>
          </div>

          {/* Expenses */}
          <div>
            <p className='text-xs text-muted-foreground'>Expenses</p>
            <p className='text-sm font-semibold tabular-nums text-red-600 dark:text-red-400'>
              -{formatAUD(totalExpenses)}
            </p>
          </div>

          {/* Net Cashflow */}
          <div>
            <p className='text-xs text-muted-foreground'>Net</p>
            <p
              className={`text-sm font-semibold tabular-nums ${
                isPositive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {formatAUD(netCashflow)}
            </p>
          </div>
        </div>

        {/* Savings Rate Progress Bar */}
        <div className='border-t border-border pt-4 dark:border-slate-700'>
          <div className='mb-2 flex items-center justify-between'>
            <p className='text-xs text-muted-foreground'>Savings Rate</p>
            <p className='text-xs font-semibold tabular-nums text-foreground'>
              {savingsRate.toFixed(1)}%
            </p>
          </div>
          <div className='h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-slate-700'>
            <div
              className='h-full bg-purple-500 transition-all duration-300 dark:bg-purple-600'
              style={{ width: `${displaySavingsRate}%` }}
              role='progressbar'
              aria-valuenow={displaySavingsRate}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
