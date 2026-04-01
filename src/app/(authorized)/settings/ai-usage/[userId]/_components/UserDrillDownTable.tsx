'use client';

import Link from 'next/link';
import { NumericFormat } from 'react-number-format';
import { ChevronLeft } from 'lucide-react';
import { IMPORT_TYPE_LABELS } from '@/constants/import-type-labels';

type CategoryRow = {
  importType: string;
  totalCostUSD: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalImages: number;
  totalSessions: number;
};

type Props = {
  userName: string;
  categories: CategoryRow[];
  exchangeRate: number;
  backHref: string;
};

export default function UserDrillDownTable({
  userName,
  categories,
  exchangeRate,
  backHref,
}: Props) {
  return (
    <div className='space-y-4'>
      {/* Breadcrumb */}
      <nav aria-label='Breadcrumb'>
        <Link
          href={backHref}
          className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded'
        >
          <ChevronLeft className='h-4 w-4' aria-hidden='true' />
          AI Spend
        </Link>
        <span className='mx-2 text-muted-foreground' aria-hidden='true'>
          /
        </span>
        <span className='text-sm font-medium text-foreground'>{userName}</span>
      </nav>

      {categories.length === 0 ? (
        <p className='py-8 text-center text-sm text-muted-foreground'>
          No AI usage recorded for this user in the selected period.
        </p>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr>
                <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
                  Category
                </th>
                <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
                  USD Cost
                </th>
                <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
                  AUD Cost
                </th>
                <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
                  Prompt Tokens
                </th>
                <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
                  Completion
                </th>
                <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
                  Total Tokens
                </th>
                <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
                  Images
                </th>
                <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
                  Sessions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border'>
              {categories.map((row) => (
                <tr
                  key={row.importType}
                  className='hover:bg-muted/30 transition-colors'
                >
                  <td className='px-4 py-3 font-medium text-foreground'>
                    {IMPORT_TYPE_LABELS[row.importType] ?? row.importType}
                  </td>
                  <td className='px-4 py-3 text-right tabular-nums'>
                    <NumericFormat
                      prefix='$'
                      displayType='text'
                      thousandSeparator
                      decimalScale={4}
                      fixedDecimalScale
                      value={row.totalCostUSD}
                    />
                  </td>
                  <td className='px-4 py-3 text-right tabular-nums'>
                    <NumericFormat
                      prefix='$'
                      displayType='text'
                      thousandSeparator
                      decimalScale={4}
                      fixedDecimalScale
                      value={row.totalCostUSD * exchangeRate}
                    />
                  </td>
                  <td className='px-4 py-3 text-right tabular-nums'>
                    <NumericFormat
                      displayType='text'
                      thousandSeparator
                      value={row.promptTokens}
                    />
                  </td>
                  <td className='px-4 py-3 text-right tabular-nums'>
                    <NumericFormat
                      displayType='text'
                      thousandSeparator
                      value={row.completionTokens}
                    />
                  </td>
                  <td className='px-4 py-3 text-right tabular-nums'>
                    <NumericFormat
                      displayType='text'
                      thousandSeparator
                      value={row.totalTokens}
                    />
                  </td>
                  <td className='px-4 py-3 text-right tabular-nums'>
                    {row.totalImages}
                  </td>
                  <td className='px-4 py-3 text-right tabular-nums'>
                    {row.totalSessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
