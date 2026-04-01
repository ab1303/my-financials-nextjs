'use client';

import { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type Props = {
  dateFrom: string;
  dateTo: string;
};

/** Compact date range inputs — uses URL params (no client state for dates) */
export default function AdminDateRangeFilter({ dateFrom, dateTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleChange(field: 'from' | 'to', value: string) {
    const params = new URLSearchParams();
    if (field === 'from') {
      params.set('from', value);
      params.set('to', dateTo);
    } else {
      params.set('from', dateFrom);
      params.set('to', value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className='flex flex-wrap items-center gap-3'
      aria-label='Date range filter'
    >
      <div className='flex items-center gap-2'>
        <label
          htmlFor='date-from'
          className='text-sm font-medium text-muted-foreground whitespace-nowrap'
        >
          From
        </label>
        <input
          id='date-from'
          type='date'
          defaultValue={dateFrom}
          onChange={(e) => handleChange('from', e.target.value)}
          className='rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          aria-label='Start date'
        />
      </div>
      <div className='flex items-center gap-2'>
        <label
          htmlFor='date-to'
          className='text-sm font-medium text-muted-foreground whitespace-nowrap'
        >
          To
        </label>
        <input
          id='date-to'
          type='date'
          defaultValue={dateTo}
          onChange={(e) => handleChange('to', e.target.value)}
          className='rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          aria-label='End date'
        />
      </div>
      {isPending && (
        <span className='text-xs text-muted-foreground' aria-live='polite'>
          Loading…
        </span>
      )}
    </div>
  );
}
