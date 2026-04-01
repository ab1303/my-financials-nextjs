'use client';

import { useMemo } from 'react';
import { NumericFormat } from 'react-number-format';
import { Sparkles } from 'lucide-react';
import { trpc } from '@/server/trpc/client';

type AIUsageCardProps = {
  importType: 'EXPENSE' | 'BANK_ASSET' | 'STOCK';
  dateFrom: Date;
  dateTo: Date;
  dateLabel: string; // e.g., "March 2026" or "FY 2025-2026"
};

export default function AIUsageCard({
  importType,
  dateFrom,
  dateTo,
  dateLabel,
}: AIUsageCardProps) {
  const { data: usage, isLoading: isUsageLoading } =
    trpc.aiUsage.getUsageSummary.useQuery(
      { importType, dateFrom, dateTo },
      { staleTime: 5 * 60 * 1000 },
    );

  const { data: fx, isLoading: isFxLoading } =
    trpc.aiUsage.getExchangeRate.useQuery(undefined, {
      staleTime: 60 * 60 * 1000,
    });

  const isLoading = isUsageLoading || isFxLoading;

  const audAmount = useMemo(() => {
    if (!usage || !fx) return 0;
    return usage.totalCostUSD * fx.rate;
  }, [usage, fx]);

  return (
    <div className='flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm shadow-sm'>
      <Sparkles className='h-4 w-4 shrink-0 text-primary' />
      <div className='flex flex-col gap-0.5 min-w-0'>
        <span className='text-xs text-muted-foreground truncate'>
          AI Import Cost · {dateLabel}
        </span>
        {isLoading ? (
          <span className='text-muted-foreground animate-pulse'>Loading…</span>
        ) : (
          <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
            <span className='font-medium text-foreground'>
              <NumericFormat
                prefix='$'
                displayType='text'
                thousandSeparator
                decimalScale={4}
                fixedDecimalScale
                value={usage?.totalCostUSD ?? 0}
              />{' '}
              USD
            </span>
            <span className='text-muted-foreground text-xs'>
              /{' '}
              <NumericFormat
                prefix='$'
                displayType='text'
                thousandSeparator
                decimalScale={4}
                fixedDecimalScale
                value={audAmount}
              />{' '}
              AUD
            </span>
            <span className='text-muted-foreground text-xs'>
              · {usage?.totalImages ?? 0} image
              {(usage?.totalImages ?? 0) !== 1 ? 's' : ''} ·{' '}
              {usage?.totalSessions ?? 0} session
              {(usage?.totalSessions ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
