'use client';

import {
  formatCurrency,
  formatPL,
  getPLColorClass,
} from '@/utils/stock-asset-calculations';

interface CurrencyTotalFromService {
  currency: string;
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
  accounts: any[];
}

interface SummaryCardsProps {
  currencyTotals: CurrencyTotalFromService[];
}

/**
 * Display portfolio summary cards, one per currency (AUD/USD).
 * Shows total market value and P/L (realized + unrealized).
 * Color-coded backgrounds: AUD (teal), USD (blue).
 */
export default function SummaryCards({ currencyTotals }: SummaryCardsProps) {
  if (!currencyTotals || currencyTotals.length === 0) {
    return (
      <div className='p-6 bg-muted rounded-lg border border-border text-center'>
        <p className='text-muted-foreground'>No holdings recorded yet</p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
      {currencyTotals.map((total) => {
        const isCurrency = total.currency === 'AUD' ? true : false;
        const currencyFlag = total.currency === 'AUD' ? '🇦🇺' : '🇺🇸';

        // Color scheme: AUD = teal, USD = blue
        const bgColor = 'bg-card border-border';
        const headerColor = isCurrency ? 'text-teal-900' : 'text-blue-900';
        const badgeColor = isCurrency
          ? 'bg-teal-100 text-teal-800'
          : 'bg-blue-100 text-blue-800';

        const totalPL = total.totalUnrealizedPL + total.totalRealizedPL;
        const totalPLColorClass = getPLColorClass(totalPL);

        return (
          <div
            key={total.currency}
            className={`p-4 rounded-lg border ${bgColor}`}
          >
            {/* Header with Currency */}
            <div className='flex items-center justify-between mb-3'>
              <h3 className={`font-semibold ${headerColor}`}>
                {currencyFlag} {total.currency} Holdings
              </h3>
            </div>

            {/* Portfolio Value + Invested Amount */}
            <div className='mb-4 flex items-end justify-between gap-4'>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Portfolio Value</p>
                <p className='text-2xl font-bold text-foreground'>
                  {formatCurrency(total.totalValue, total.currency as any)}
                </p>
              </div>
              <div className='text-right'>
                <p className='text-sm text-muted-foreground mb-1'>Invested Amount</p>
                <p className='text-lg font-semibold text-foreground'>
                  {formatCurrency(total.totalCostBasis, total.currency as any)}
                </p>
              </div>
            </div>

            {/* P/L Breakdown */}
            <div className='space-y-2'>
              {/* Unrealized P/L */}
              <div className='flex justify-between items-center py-2 border-t border-border border-opacity-50'>
                <p className='text-sm text-muted-foreground'>Unrealized P/L</p>
                <p
                  className={`font-semibold ${getPLColorClass(total.totalUnrealizedPL)}`}
                >
                  {formatPL(total.totalUnrealizedPL, total.currency as any)}
                </p>
              </div>

              {/* Realized P/L */}
              <div className='flex justify-between items-center py-2 border-t border-border border-opacity-50'>
                <p className='text-sm text-muted-foreground'>Realized P/L</p>
                <p
                  className={`font-semibold ${getPLColorClass(total.totalRealizedPL)}`}
                >
                  {formatPL(total.totalRealizedPL, total.currency as any)}
                </p>
              </div>

              {/* Total P/L */}
              <div className='flex justify-between items-center py-3 border-t-2 border-border'>
                <p className='font-semibold text-foreground'>Total P/L</p>
                <p className={`text-lg font-bold ${totalPLColorClass}`}>
                  {formatPL(totalPL, total.currency as any)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
