import { TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardSummaryResponse } from '@/server/models/dashboard';

import { NetWorthSparkline } from './NetWorthSparkline';

interface Props {
  netWorth: DashboardSummaryResponse['netWorth'];
}

/**
 * NetWorthWidget - Server Component
 * Displays the total net worth with a historical sparkline chart
 * Shows latest total, breakdown by cash and stocks, and last 6 data points
 */
export function NetWorthWidget({ netWorth }: Props) {
  const { latestTotal, latestCashTotal, latestStockTotal, sparklinePoints } =
    netWorth;

  const formatAUD = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  // Empty state: no snapshots recorded yet
  if (sparklinePoints.length === 0) {
    return (
      <Card className='col-span-full dark:border-slate-700'>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
            <TrendingUp className='h-4 w-4 text-primary' aria-hidden='true' />
            Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No data available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='col-span-full dark:border-slate-700'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
          <TrendingUp className='h-4 w-4 text-primary' aria-hidden='true' />
          Net Worth
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Latest Total */}
        <div>
          <p className='text-3xl font-bold tabular-nums text-foreground'>
            {formatAUD(latestTotal)}
          </p>
        </div>

        {/* Sparkline Chart */}
        <div className='h-[60px] w-full'>
          <NetWorthSparkline data={sparklinePoints} />
        </div>

        {/* Cash vs Stock Breakdown */}
        <div className='grid grid-cols-2 gap-4 border-t border-border pt-4 dark:border-slate-700'>
          <div>
            <p className='text-xs text-muted-foreground'>Cash</p>
            <p className='text-sm font-semibold tabular-nums text-foreground'>
              {formatAUD(latestCashTotal)}
            </p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Stocks</p>
            <p className='text-sm font-semibold tabular-nums text-foreground'>
              {formatAUD(latestStockTotal)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
