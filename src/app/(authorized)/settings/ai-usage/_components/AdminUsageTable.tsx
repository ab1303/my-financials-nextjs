'use client';

import { useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

type UserRow = {
  userId: string;
  userName: string;
  email: string;
  totalCostUSD: number;
  totalTokens: number;
  totalSessions: number;
  totalImages: number;
};

type Props = {
  rows: UserRow[];
  exchangeRate: number;
  dateFrom: string;
  dateTo: string;
};

export default function AdminUsageTable({
  rows,
  exchangeRate,
  dateFrom,
  dateTo,
}: Props) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        No AI usage recorded for this period.
      </p>
    );
  }

  return (
    <div className='overflow-x-auto rounded-lg border border-border'>
      <table className='w-full text-sm'>
        <thead className='bg-muted/50'>
          <tr>
            <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
              User
            </th>
            <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
              Email
            </th>
            <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
              USD Cost
            </th>
            <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
              AUD Cost
            </th>
            <th className='px-4 py-3 text-right font-medium text-muted-foreground tabular-nums'>
              Tokens
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
          {rows.map((row) => (
            <tr
              key={row.userId}
              className='cursor-pointer hover:bg-muted/40 transition-colors'
              onClick={() =>
                router.push(
                  `/settings/ai-usage/${row.userId}?from=${dateFrom}&to=${dateTo}`,
                )
              }
              tabIndex={0}
              role='button'
              aria-label={`View breakdown for ${row.userName}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  router.push(
                    `/settings/ai-usage/${row.userId}?from=${dateFrom}&to=${dateTo}`,
                  );
                }
              }}
            >
              <td className='px-4 py-3 font-medium text-foreground'>
                {row.userName}
              </td>
              <td className='px-4 py-3 text-muted-foreground'>{row.email}</td>
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
  );
}
