'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
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
  usdToAudRate: number | null;
  snapshotDate: Date | null;
  snapshotId: string | null;
}

/**
 * Display portfolio summary cards, one per currency (AUD/USD).
 * Shows total market value and P/L (realized + unrealized).
 * Color-coded backgrounds: AUD (teal), USD (blue).
 */
export default function SummaryCards({ currencyTotals, usdToAudRate, snapshotDate, snapshotId }: SummaryCardsProps) {
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [editRateValue, setEditRateValue] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const updateFxRate = trpc.stockAsset.updateSnapshotFxRate.useMutation({
    onSuccess: () => {
      toast.success('Exchange rate updated');
      setIsEditingRate(false);
      utils.stockAsset.getSnapshotTotals.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update rate');
    },
  });

  const handleEditRate = () => {
    setEditRateValue(usdToAudRate);
    setIsEditingRate(true);
  };

  const handleSaveRate = () => {
    if (!snapshotId) return;
    updateFxRate.mutate({ snapshotId, usdToAudRate: editRateValue });
  };

  const handleCancelEdit = () => {
    setIsEditingRate(false);
    setEditRateValue(null);
  };

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
              <div className='flex justify-between items-center py-2 border-t border-border border-opacity-50'>
                <p className='text-sm text-muted-foreground'>Unrealized P/L</p>
                <p className={`font-semibold ${getPLColorClass(total.totalUnrealizedPL)}`}>
                  {formatPL(total.totalUnrealizedPL, total.currency as any)}
                </p>
              </div>
              <div className='flex justify-between items-center py-2 border-t border-border border-opacity-50'>
                <p className='text-sm text-muted-foreground'>Realized P/L</p>
                <p className={`font-semibold ${getPLColorClass(total.totalRealizedPL)}`}>
                  {formatPL(total.totalRealizedPL, total.currency as any)}
                </p>
              </div>
              <div className='flex justify-between items-center py-3 border-t-2 border-border'>
                <p className='font-semibold text-foreground'>Total P/L</p>
                <p className={`text-lg font-bold ${totalPLColorClass}`}>
                  {formatPL(totalPL, total.currency as any)}
                </p>
              </div>
            </div>

            {/* AUD Equivalent (USD card only) */}
            {total.currency === 'USD' && (
              <div className='mt-3 pt-3 border-t border-border'>
                {/* Rate header row */}
                <div className='flex items-center justify-between mb-2'>
                  <p className='text-xs text-muted-foreground'>
                    AUD Equivalent
                    {usdToAudRate && !isEditingRate && (
                      <span className='ml-1'>
                        · 1 USD = {usdToAudRate.toFixed(4)} AUD
                        {snapshotDate && (
                          <span className='ml-1'>
                            · {new Date(snapshotDate).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                  {snapshotId && !isEditingRate && (
                    <button
                      onClick={handleEditRate}
                      className='text-muted-foreground hover:text-foreground transition-colors p-0.5'
                      title={usdToAudRate ? 'Edit rate' : 'Add rate'}
                      aria-label={usdToAudRate ? 'Edit exchange rate' : 'Add exchange rate'}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>

                {/* Inline rate editor */}
                {isEditingRate && (
                  <div className='flex items-center gap-2 mb-2'>
                    <span className='text-xs text-muted-foreground whitespace-nowrap'>1 USD =</span>
                    <NumericFormat
                      value={editRateValue ?? ''}
                      onValueChange={({ floatValue }) => setEditRateValue(floatValue ?? null)}
                      decimalScale={4}
                      placeholder='e.g. 1.5470'
                      autoFocus
                      className='flex-1 px-2 py-1 text-sm border border-input bg-background rounded focus:outline-none focus:ring-1 focus:ring-ring'
                    />
                    <span className='text-xs text-muted-foreground'>AUD</span>
                    <button
                      onClick={handleSaveRate}
                      disabled={updateFxRate.isPending}
                      className='text-green-600 hover:text-green-700 transition-colors p-0.5'
                      aria-label='Save rate'
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className='text-muted-foreground hover:text-foreground transition-colors p-0.5'
                      aria-label='Cancel'
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* AUD values or fallback */}
                {usdToAudRate && !isEditingRate ? (
                  <div className='flex justify-between items-end'>
                    <div>
                      <p className='text-xs text-muted-foreground mb-0.5'>Portfolio Value</p>
                      <p className='text-lg font-semibold text-foreground'>
                        {formatCurrency(total.totalValue * usdToAudRate, 'AUD')}
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='text-xs text-muted-foreground mb-0.5'>Invested Amount</p>
                      <p className='text-base font-medium text-foreground'>
                        {formatCurrency(total.totalCostBasis * usdToAudRate, 'AUD')}
                      </p>
                    </div>
                  </div>
                ) : !isEditingRate ? (
                  <p className='text-xs text-muted-foreground italic'>
                    AUD equivalent not available — click <Pencil size={10} className='inline mb-0.5' /> to add rate
                  </p>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
