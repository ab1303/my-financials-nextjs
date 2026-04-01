import { Sparkles } from 'lucide-react';
import {
  getAIUsageSummary,
  getExchangeRate,
} from '@/server/services/ai-usage-queries';
import { IMPORT_TYPE_LABELS } from '@/constants/import-type-labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ImportType = 'EXPENSE' | 'BANK_ASSET' | 'STOCK';

type Props = {
  userId: string;
  importType: ImportType;
  dateFrom: Date;
  dateTo: Date;
};

/** Async RSC — fetches its own data so all three cards stream independently */
export async function AIUsageDashboardCard({
  userId,
  importType,
  dateFrom,
  dateTo,
}: Props) {
  // getExchangeRate and getAIUsageSummary both use React.cache(), so parallel
  // calls within the same request are deduplicated automatically.
  const [usage, rate] = await Promise.all([
    getAIUsageSummary(userId, importType, dateFrom, dateTo),
    getExchangeRate(),
  ]);

  const audAmount = usage.totalCostUSD * rate;
  const label = IMPORT_TYPE_LABELS[importType] ?? importType;

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
          <Sparkles className='h-4 w-4 text-primary' aria-hidden='true' />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-1'>
        <p
          className='text-lg font-semibold tabular-nums text-foreground'
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          ${usage.totalCostUSD.toFixed(4)}{' '}
          <span className='text-sm font-normal text-muted-foreground'>USD</span>
        </p>
        <p className='text-xs text-muted-foreground tabular-nums'>
          ${audAmount.toFixed(4)} <span>AUD</span>
        </p>
        <p className='text-xs text-muted-foreground'>
          {usage.totalImages} image{usage.totalImages !== 1 ? 's' : ''} &middot;{' '}
          {usage.totalSessions} session{usage.totalSessions !== 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  );
}

/** Skeleton shown while streaming */
export function AIUsageDashboardCardSkeleton() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <div className='h-4 w-32 rounded bg-muted animate-pulse' />
      </CardHeader>
      <CardContent className='space-y-2'>
        <div className='h-6 w-24 rounded bg-muted animate-pulse' />
        <div className='h-3 w-20 rounded bg-muted animate-pulse' />
        <div className='h-3 w-28 rounded bg-muted animate-pulse' />
      </CardContent>
    </Card>
  );
}
