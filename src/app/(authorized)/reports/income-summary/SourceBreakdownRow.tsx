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
      <div className='py-4 text-center text-sm text-gray-500'>
        No source data available for this month.
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-lg border bg-white'>
      <table className='min-w-full divide-y divide-gray-200'>
        <thead className='bg-gray-100'>
          <tr>
            <th className='px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600'>
              Source
            </th>
            <th className='px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-600'>
              Amount
            </th>
            <th className='px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-600'>
              Percentage
            </th>
            <th className='px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-600'>
              Entries
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200 bg-white'>
          {breakdown.map((item) => (
            <tr key={item.source}>
              <td className='whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900'>
                {INCOME_SOURCE_LABELS[item.source]}
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900'>
                <NumericFormat
                  value={item.amount}
                  displayType='text'
                  thousandSeparator
                  prefix='$'
                  decimalScale={2}
                  fixedDecimalScale
                />
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900'>
                <NumericFormat
                  value={item.percentage}
                  displayType='text'
                  suffix='%'
                  decimalScale={1}
                  fixedDecimalScale
                />
              </td>
              <td className='whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500'>
                {item.entryCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
