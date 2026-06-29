'use client';

import { ArrowUpDown, PiggyBank, Receipt, TrendingUp } from 'lucide-react';
import { NumericFormat } from 'react-number-format';

import { Card, CardContent } from '@/components/ui/card';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { Skeleton } from '@/components/ui/skeleton';
import type { CashflowKPIs } from '@/server/models/cashflow-analytics';

type KPISummaryCardsProps = {
  kpis: CashflowKPIs | null;
  loading: boolean;
};

export function KPISummaryCards({ kpis, loading }: KPISummaryCardsProps) {
  if (loading) {
    return (
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-24 w-full' />
        ))}
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className='text-center text-sm text-muted-foreground py-8'>
        No KPI data available
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Income',
      value: kpis.totalIncome,
      icon: TrendingUp,
      valueColor: 'text-green-600 dark:text-green-400',
      format: 'currency',
    },
    {
      title: 'Total Expenses',
      value: kpis.totalExpenses,
      icon: Receipt,
      valueColor: 'text-red-600 dark:text-red-400',
      format: 'currency',
    },
    {
      title: 'Net Cashflow',
      value: kpis.netCashflow,
      icon: ArrowUpDown,
      valueColor:
        kpis.netCashflow >= 0
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-600 dark:text-red-400',
      format: 'currency',
      prefix: kpis.netCashflow >= 0 ? '+' : '',
    },
  ];

  return (
    <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className='border-border/40'>
            <CardContent className='pt-6'>
              <div className='flex items-start justify-between'>
                <div className='space-y-1 flex-1'>
                  <p className='text-xs font-medium text-muted-foreground'>
                    {card.title}
                  </p>
                  <p className={`text-lg font-semibold ${card.valueColor}`}>
                    {card.prefix}
                    <NumericFormat
                      value={Math.abs(card.value)}
                      displayType='text'
                      thousandSeparator=','
                      prefix='$'
                      decimalScale={0}
                      fixedDecimalScale
                    />
                  </p>
                </div>
                <Icon className='h-4 w-4 text-muted-foreground' />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Savings Rate Card */}
      <Card className='border-border/40 md:col-span-1 col-span-2'>
        <CardContent className='pt-6'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Savings Rate
                </p>
                <InfoTooltip text='Savings Rate = (Income − Expenses) ÷ Income × 100. Target: 20%+' />
              </div>
              <PiggyBank className='h-4 w-4 text-muted-foreground' />
            </div>

            <div className='space-y-2'>
              <p className='text-lg font-semibold text-foreground'>
                {kpis.totalIncome > 0 ? kpis.savingsRate.toFixed(1) : 'N/A'}%
              </p>

              {/* Progress bar toward 20% target */}
              <div className='h-1.5 w-full bg-muted rounded-full overflow-hidden'>
                <div
                  className='h-full bg-blue-400 dark:bg-blue-500 rounded-full transition-all'
                  style={{
                    width: `${Math.min(
                      kpis.totalIncome > 0 ? Math.max(0, kpis.savingsRate) : 0,
                      100,
                    )}%`,
                  }}
                />
              </div>
              <p className='text-xs text-muted-foreground'>Target: 20%+</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
