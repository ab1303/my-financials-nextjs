'use client';

import { NumericFormat } from 'react-number-format';

import SourceBadge from './SourceBadge';
import type { IncomeEntryType } from '../_types';

export const SOURCE_COLOR_BAR_MAP: Record<string, string> = {
  employment: 'bg-blue-500',
  stocks: 'bg-green-500',
  dividend: 'bg-yellow-500',
  rental: 'bg-purple-500',
  business: 'bg-orange-500',
  interest: 'bg-cyan-500',
  other: 'bg-gray-400',
};

type SourceBreakdownWidgetProps = {
  entries: IncomeEntryType[];
};

type SourceSummary = {
  sourceName: string;
  total: number;
  percentage: number;
};

export function computeBreakdown(entries: IncomeEntryType[]): SourceSummary[] {
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    totals[entry.incomeSourceName] = (totals[entry.incomeSourceName] ?? 0) + entry.amount;
  }
  const grand = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return Object.entries(totals)
    .map(([sourceName, total]) => ({
      sourceName,
      total,
      percentage: grand > 0 ? (total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export default function SourceBreakdownWidget({ entries }: SourceBreakdownWidgetProps) {
  if (entries.length === 0) return null;

  const breakdown = computeBreakdown(entries);

  return (
    <div className='mb-4 rounded-lg border border-border bg-card/50 p-3'>
      <div className='flex h-2 w-full overflow-hidden rounded-full bg-muted'>
        {breakdown.map((summary) => (
          <div
            key={summary.sourceName}
            style={{ width: `${summary.percentage}%` }}
            className={SOURCE_COLOR_BAR_MAP[summary.sourceName.toLowerCase()] ?? 'bg-gray-400'}
            title={`${summary.sourceName}: ${summary.percentage.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className='mt-2 flex flex-wrap gap-3'>
        {breakdown.map((summary) => (
          <div key={summary.sourceName} className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <SourceBadge sourceName={summary.sourceName} />
            <NumericFormat
              value={summary.total}
              displayType='text'
              thousandSeparator
              prefix='$'
              decimalScale={2}
              fixedDecimalScale
            />
            <span>({summary.percentage.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
