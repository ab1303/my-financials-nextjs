'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { NumericFormat } from 'react-number-format';

import { DistributionWidget, type DistributionItem } from '@/components/ui/DistributionWidget';

type BeneficiaryBreakdown = Record<string, number>;

type Props = {
  breakdown: BeneficiaryBreakdown;
  yearDateFrom: string;
  yearDateTo: string;
};

// Simple cycle of colors for beneficiaries
const BENEFICIARY_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500', 'bg-indigo-500', 'bg-yellow-500',
];

export default function DonationBeneficiaryBreakdownWidget({ breakdown, yearDateFrom, yearDateTo }: Props) {
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  if (total === 0) return null;

  const distributionItems: DistributionItem[] = Object.entries(breakdown)
    .map(([name, amount], i) => ({
      name,
      total: amount,
      percentage: (amount / total) * 100,
      color: BENEFICIARY_COLORS[i % BENEFICIARY_COLORS.length] ?? 'bg-gray-400',
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className='mb-6'>
      <h3 className='text-sm font-medium text-foreground mb-2'>Distribution by Beneficiary</h3>
      <DistributionWidget
        items={distributionItems}
        renderItem={(item) => {
          const url = `/cashflow/transactions?tab=donations&beneficiaryName=${encodeURIComponent(item.name)}&dateFrom=${yearDateFrom}&dateTo=${yearDateTo}`;
          return (
            <Link
              key={item.name}
              href={url}
              className='flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors'
              title={`View ${item.name} transactions`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${item.color}`} />
              {item.name}
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
    </div>
  );
}
