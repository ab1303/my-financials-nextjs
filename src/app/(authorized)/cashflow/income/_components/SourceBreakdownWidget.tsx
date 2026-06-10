'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { NumericFormat } from 'react-number-format';

import { DistributionWidget, type DistributionItem } from '@/components/ui/DistributionWidget';
import type { IncomeEntryType } from '../_types';
import SourceBadge from './SourceBadge';

export const SOURCE_COLOR_BAR_MAP: Record<string, string> = {
  employment: 'bg-blue-500',
  stocks: 'bg-green-500',
  dividend: 'bg-amber-500',
  rental: 'bg-purple-500',
  business: 'bg-orange-500',
  interest: 'bg-cyan-500',
  'credit interest': 'bg-sky-500',
  'tax rebate': 'bg-fuchsia-500',
  'medicare rebate': 'bg-rose-500',
  other: 'bg-gray-400',
};

type SourceBreakdownWidgetProps = {
  entries: IncomeEntryType[];
  yearDateFrom?: string;
  yearDateTo?: string;
};

type SourceSummary = {
  sourceName: string;
  total: number;
  percentage: number;
};

type IncomeDistributionItem = DistributionItem & SourceSummary;

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

export default function SourceBreakdownWidget({ entries, yearDateFrom, yearDateTo }: SourceBreakdownWidgetProps) {
  if (entries.length === 0) return null;

  const breakdown = computeBreakdown(entries);
  const distributionItems: IncomeDistributionItem[] = breakdown.map((item) => ({
    name: item.sourceName,
    total: item.total,
    percentage: item.percentage,
    color: SOURCE_COLOR_BAR_MAP[item.sourceName.toLowerCase()] ?? 'bg-gray-400',
    sourceName: item.sourceName,
  }));

  return (
    <DistributionWidget
      items={distributionItems}
      renderItem={(item) => {
        const url = `/cashflow/transactions?tab=income&categoryName=${encodeURIComponent(item.name)}${yearDateFrom ? `&dateFrom=${yearDateFrom}` : ''}${yearDateTo ? `&dateTo=${yearDateTo}` : ''}`;
        return (
          <Link
            key={item.name}
            href={url}
            className='flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors'
            title={`View ${item.name} transactions`}
          >
            <SourceBadge sourceName={item.name} />
            <NumericFormat
              value={item.total}
              displayType='text'
              thousandSeparator
              prefix='$'
              decimalScale={2}
              fixedDecimalScale
            />
            <span>({item.percentage.toFixed(1)}%)</span>
            <ExternalLink size={13} className='ml-0.5 opacity-70' />
          </Link>
        );
      }}
    />
  );
}
