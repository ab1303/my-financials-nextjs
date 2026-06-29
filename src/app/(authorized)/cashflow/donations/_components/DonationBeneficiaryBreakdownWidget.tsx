'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import {
  type DistributionItem,
  DistributionWidget,
} from '@/components/ui/DistributionWidget';

type BeneficiaryBreakdownItem = {
  id: string;
  name: string;
  total: number;
};

type Props = {
  breakdown: BeneficiaryBreakdownItem[];
};

// Simple cycle of colors for beneficiaries
const BENEFICIARY_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-orange-500',
  'bg-indigo-500',
  'bg-yellow-500',
];

export default function DonationBeneficiaryBreakdownWidget({
  breakdown,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeBeneficiaryId = searchParams.get('beneficiaryId');

  const total = breakdown.reduce((sum, item) => sum + item.total, 0);
  if (total === 0) return null;

  const distributionItems: (DistributionItem & { id: string })[] = breakdown
    .map((item, i) => ({
      name: item.name,
      total: item.total,
      percentage: (item.total / total) * 100,
      color: BENEFICIARY_COLORS[i % BENEFICIARY_COLORS.length] ?? 'bg-gray-400',
      id: item.id,
    }))
    .sort((a, b) => b.total - a.total);

  const handleFilter = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('beneficiaryId', id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const resetFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('beneficiaryId');
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className='mb-6'>
      <div className='flex items-center justify-between mb-2'>
        <h3 className='text-sm font-medium text-foreground'>
          Distribution by Beneficiary
        </h3>
        {activeBeneficiaryId && (
          <button
            onClick={resetFilter}
            className='text-xs text-muted-foreground hover:text-destructive transition-colors underline'
          >
            Reset Filter
          </button>
        )}
      </div>
      <DistributionWidget
        items={distributionItems}
        renderItem={(item: DistributionItem & { id: string }) => (
          <button
            key={item.id}
            onClick={() => handleFilter(item.id)}
            className={`flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors ${activeBeneficiaryId === item.id ? 'bg-muted text-foreground' : ''}`}
            title={`Filter by ${item.name}`}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${item.color}`}
            />
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
          </button>
        )}
      />
    </div>
  );
}
