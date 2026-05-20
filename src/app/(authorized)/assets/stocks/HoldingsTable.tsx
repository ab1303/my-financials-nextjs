'use client';

import { useMemo } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components';
import {
  calculateHoldingMetrics,
  formatCurrency,
  formatQuantity,
  formatPrice,
  formatPercentage,
  formatHoldingPeriod,
  getPLColorClass,
  getTermStatusColorClass,
  getTermStatusLabel,
} from '@/utils/stock-asset-calculations';
import type { StockHoldingWithAccount } from '@/types/stock-asset.types';

interface HoldingsTableProps {
  holdings: StockHoldingWithAccount[];
  snapshotDate: Date;
  snapshotId: string;
  accountId: string;
  onEdit: (holding: StockHoldingWithAccount) => void;
  onDeleteConfirm: (holdingId: string, ticker: string, snapshotId: string) => void;
  onAddHolding: (accountId: string) => void;
}

export default function HoldingsTable({
  holdings,
  snapshotDate,
  snapshotId,
  accountId,
  onEdit,
  onDeleteConfirm,
  onAddHolding,
}: HoldingsTableProps) {
  const holdingRows = useMemo(
    () =>
      holdings.map((h) => ({
        holding: h,
        metrics: calculateHoldingMetrics(h, snapshotDate),
      })),
    [holdings, snapshotDate],
  );

  const subtotals = useMemo(
    () =>
      holdingRows.reduce(
        (acc, { metrics }) => ({
          totalMarketValue: acc.totalMarketValue + metrics.marketValue,
          totalUnrealizedPL: acc.totalUnrealizedPL + metrics.unrealizedPL,
        }),
        { totalMarketValue: 0, totalUnrealizedPL: 0 },
      ),
    [holdingRows],
  );

  // All holdings in this table share the same currency (grouped upstream)
  const currency = holdings[0]?.currency;

  return (
    <div>
      <div className='overflow-x-auto'>
        <table className='min-w-full divide-y divide-border'>
          <thead className='bg-muted'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Stock
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Qty
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Buy Price
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Buy Date
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Curr Price
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Value
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                P/L
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                P/L %
              </th>
              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Holding
              </th>
              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Term
              </th>
              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                CGT
              </th>
              <th className='px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider select-none cursor-default'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className='bg-card divide-y divide-border'>
            {holdingRows.map(({ holding, metrics }) => (
              <tr
                key={holding.id}
                className={clsx('hover:bg-muted/50', metrics.isSold && 'opacity-75')}
              >
                {/* Stock: ticker + company */}
                <td className='px-6 py-4 text-sm'>
                  <div className='font-semibold text-foreground'>
                    {holding.ticker}
                    {metrics.isSold && (
                      <span className='ml-2 inline-block px-2 py-1 text-xs font-semibold bg-muted text-foreground rounded'>
                        SOLD
                      </span>
                    )}
                  </div>
                  <div className='text-xs text-muted-foreground'>{holding.companyName}</div>
                </td>

                {/* Quantity */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-foreground'>
                  {formatQuantity(metrics.remainingQuantity)}
                </td>

                {/* Buy Price */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground'>
                  {formatPrice(Number(holding.buyPrice), holding.currency)}
                </td>

                {/* Buy Date */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground'>
                  {holding.buyDate
                    ? new Date(holding.buyDate).toLocaleDateString('en-AU', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </td>

                {/* Current Price */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground'>
                  {formatPrice(Number(holding.currentPrice), holding.currency)}
                </td>

                {/* Market Value */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-foreground'>
                  {formatCurrency(metrics.marketValue, holding.currency)}
                </td>

                {/* Unrealized P/L */}
                <td
                  className={clsx(
                    'px-6 py-4 whitespace-nowrap text-sm text-right font-semibold',
                    getPLColorClass(metrics.unrealizedPL),
                  )}
                >
                  {formatCurrency(metrics.unrealizedPL, holding.currency)}
                </td>

                {/* P/L % */}
                <td
                  className={clsx(
                    'px-6 py-4 whitespace-nowrap text-sm text-right font-semibold',
                    getPLColorClass(metrics.unrealizedPLPercent),
                  )}
                >
                  {formatPercentage(metrics.unrealizedPLPercent)}
                </td>

                {/* Holding Period */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-center text-muted-foreground'>
                  {formatHoldingPeriod(metrics.holdingPeriodMonths)}
                </td>

                {/* Term Status */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-center'>
                  <span
                    className={clsx(
                      'inline-block px-2 py-1 text-xs font-semibold rounded',
                      getTermStatusColorClass(metrics.termStatus),
                    )}
                  >
                    {getTermStatusLabel(metrics.termStatus)}
                  </span>
                </td>

                {/* CGT Eligibility */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-center'>
                  {metrics.isSold ? (
                    metrics.isCGTEligible ? (
                      <span className='text-green-600 font-semibold'>✓</span>
                    ) : (
                      <span className='text-red-600'>✗</span>
                    )
                  ) : (
                    <span className='text-muted-foreground text-xs'>N/A</span>
                  )}
                </td>

                {/* Actions */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-center space-x-2'>
                  <button
                    onClick={() => onEdit(holding)}
                    className='text-indigo-600 hover:text-indigo-700 inline-block'
                    title='Edit holding'
                    aria-label={`Edit ${holding.ticker}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => onDeleteConfirm(holding.id, holding.ticker, snapshotId)}
                    className='text-red-600 hover:text-red-700 inline-block'
                    title='Delete holding'
                    aria-label={`Delete ${holding.ticker}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Subtotal footer row */}
          {holdings.length > 0 && currency && (
            <tfoot>
              <tr className='bg-muted/70'>
                <td
                  colSpan={5}
                  className='px-6 py-2 text-xs text-right text-muted-foreground font-medium'
                >
                  Subtotal
                </td>
                <td className='px-6 py-2 text-sm text-right font-semibold text-foreground'>
                  {formatCurrency(subtotals.totalMarketValue, currency)}
                </td>
                <td
                  className={clsx(
                    'px-6 py-2 text-sm text-right font-semibold',
                    getPLColorClass(subtotals.totalUnrealizedPL),
                  )}
                >
                  {formatCurrency(subtotals.totalUnrealizedPL, currency)}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add Holding button */}
      <div className='mt-4 flex justify-end'>
        <Button variant='secondary' onClick={() => onAddHolding(accountId)}>
          <Plus className='mr-2 w-4 h-4' />
          Add Holding
        </Button>
      </div>
    </div>
  );
}
