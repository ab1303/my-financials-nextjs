'use client';

import type { CalendarEnumType } from '@prisma/client';
import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { trpc } from '@/server/trpc/client';
import type { CalendarYearType } from '@/app/(authorized)/settings/calendar/_types';

import AssetSummaryCards from './_components/AssetSummaryCards';
import NetWorthChart from './_components/NetWorthChart';

type LensType = 'ALL' | CalendarEnumType;
type LineType = 'total' | 'cash' | 'stocks';

type NetWorthDashboardClientProps = {
  calendarYears: CalendarYearType[];
};

export default function NetWorthDashboardClient({
  calendarYears,
}: NetWorthDashboardClientProps) {
  const [selectedType, setSelectedType] = useState<LensType>('ALL');
  const [selectedCalendarYearId, setSelectedCalendarYearId] = useState<
    string | null
  >(null);
  const [visibility, setVisibility] = useState({
    total: true,
    cash: true,
    stocks: true,
  });

  const filteredCalendarYears = useMemo(
    () =>
      selectedType === 'ALL'
        ? []
        : calendarYears.filter((year) => year.type === selectedType),
    [calendarYears, selectedType],
  );

  useEffect(() => {
    if (selectedType === 'ALL') {
      setSelectedCalendarYearId(null);
      return;
    }

    if (!selectedCalendarYearId && filteredCalendarYears[0]?.id) {
      setSelectedCalendarYearId(filteredCalendarYears[0].id);
      return;
    }

    if (
      selectedCalendarYearId &&
      !filteredCalendarYears.some((year) => year.id === selectedCalendarYearId)
    ) {
      setSelectedCalendarYearId(filteredCalendarYears[0]?.id ?? null);
    }
  }, [filteredCalendarYears, selectedCalendarYearId, selectedType]);

  const { data, isLoading, isError, error } =
    trpc.assetDashboard.getNetWorthTrend.useQuery(
      {
        calendarYearId:
          selectedType === 'ALL' ? undefined : selectedCalendarYearId ?? undefined,
      },
      {
        enabled: selectedType === 'ALL' || Boolean(selectedCalendarYearId),
      },
    );

  const toggleLine = (line: LineType) => {
    setVisibility((previous) => ({
      ...previous,
      [line]: !previous[line],
    }));
  };

  return (
    <div className='space-y-6'>
      <section className='rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900'>
        <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
          Calendar Lens
        </h2>
        <div className='mt-3 flex flex-wrap gap-2'>
          {(['ALL', 'FISCAL', 'ANNUAL', 'ZAKAT'] as LensType[]).map((type) => (
            <button
              key={type}
              type='button'
              onClick={() => setSelectedType(type)}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                selectedType === type
                  ? 'bg-teal-600 text-white dark:bg-teal-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {selectedType !== 'ALL' && (
          <div className='mt-4'>
            <label
              htmlFor='calendar-year-select'
              className='mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'
            >
              Calendar Year
            </label>
            <select
              id='calendar-year-select'
              className='block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-teal-400 dark:focus:ring-teal-400'
              value={selectedCalendarYearId ?? ''}
              onChange={(event) =>
                setSelectedCalendarYearId(event.target.value || null)
              }
            >
              {filteredCalendarYears.length === 0 && (
                <option value=''>No calendar year configured</option>
              )}
              {filteredCalendarYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.description}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <AssetSummaryCards
        latestNetWorth={data?.latestNetWorth ?? 0}
        latestCashTotal={data?.latestCashTotal ?? 0}
        latestStockTotal={data?.latestStockTotal ?? 0}
        latestCashDate={data?.latestCashDate ?? null}
        latestStockDate={data?.latestStockDate ?? null}
        isLoading={isLoading}
      />

      <section className='space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
            Net Worth Trend
          </h2>
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => toggleLine('total')}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-medium',
                visibility.total
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              Total
            </button>
            <button
              type='button'
              onClick={() => toggleLine('cash')}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-medium',
                visibility.cash
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              Cash
            </button>
            <button
              type='button'
              onClick={() => toggleLine('stocks')}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-medium',
                visibility.stocks
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              Stocks
            </button>
          </div>
        </div>

        {isError ? (
          <div className='rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'>
            {error.message || 'Failed to load net worth trend.'}
          </div>
        ) : (
          <NetWorthChart data={data?.dataPoints ?? []} visibility={visibility} />
        )}
      </section>

      <section className='flex flex-wrap gap-3'>
        <Link
          href='/assets/bank'
          className='inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60'
        >
          View Cash Detail
        </Link>
        <Link
          href='/assets/stocks'
          className='inline-flex items-center rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/60'
        >
          View Stock Detail
        </Link>
      </section>
    </div>
  );
}
