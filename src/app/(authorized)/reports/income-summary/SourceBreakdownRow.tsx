'use client';

import type { SourceBreakdown } from '@/server/models/income';
import { NumericFormat } from 'react-number-format';
import { INCOME_SOURCE_LABELS } from '@/app/(authorized)/cashflow/income/_types';

type SourceBreakdownRowProps = {
  breakdown: SourceBreakdown[];
};

export default function SourceBreakdownRow({
  breakdown,
}: SourceBreakdownRowProps) {
  if (breakdown.length === 0) {
    return (
      <div className='py-4 text-center text-sm text-muted-foreground'>
        No source data available for this month.
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-lg border bg-card'>
      <table className='min-w-full divide-y divide-border'>
        <thead className='bg-muted'>
          <tr>
            <th className='px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              Source
            </th>
            <th className='px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              Amount
            </th>
            <th className='px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              Percentage
            </th>
            <th className='px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground'>
              Entries
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border bg-card'>
          {breakdown.map((item) => (
            <tr key={item.source}>
              <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground'>
                {INCOME_SOURCE_LABELS[item.source]}
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-right text-sm text-foreground'>
                <NumericFormat
                  value={item.amount}
                  displayType='text'
                  thousandSeparator
                  prefix='$'
                  decimalScale={2}
                  fixedDecimalScale
                />
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-right text-sm text-foreground'>
                <NumericFormat
                  value={item.percentage}
                  displayType='text'
                  suffix='%'
                  decimalScale={1}
                  fixedDecimalScale
                />
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-center text-sm text-muted-foreground'>
                {item.entryCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
