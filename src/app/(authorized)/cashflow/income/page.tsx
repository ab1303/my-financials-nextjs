import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { totalIncomeHandler } from '@/server/controllers/income.controller';
import { auth } from '@/server/auth';

import IncomeForm from './form';
import IncomeTableServer from './IncomeTableServer';

export const metadata: Metadata = {
  title: 'Income Tracking | My Financials',
  description: 'Track and manage your income entries across fiscal years',
};

// Next.js v15: searchParams is now a Promise
function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;
  return selected || '';
}

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // Get user session for user-specific data
  const session = await auth();
  if (!session?.user?.id) {
    // Redirect to login or show error
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
        <p className='text-red-800 font-medium'>Authentication required</p>
        <p className='text-red-600 text-sm mt-1'>
          Please log in to access income tracking.
        </p>
      </div>
    );
  }

  const fromYearParam = +getSelectedParam(params?.fromYear);
  const toYearParam = +getSelectedParam(params?.toYear);
  const calendarYears = await getCalendarYearsHandler();

  const incomeYearData = calendarYears.filter((yd) => yd.type === 'FISCAL');
  const selectedCalendarYear = incomeYearData.find(
    (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam,
  );

  const selectedCalendarYearId = selectedCalendarYear
    ? selectedCalendarYear.id
    : '';

  const totalIncome = await totalIncomeHandler(
    selectedCalendarYearId,
    session.user.id,
  );

  const initialData = {
    incomeYearData,
    totalIncome,
  };

  return (
    <main className='container mx-auto px-4 py-6 max-w-6xl'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Income Tracking
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Track and manage your income entries across fiscal years
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
        <IncomeForm
          initialData={initialData}
          yearIdParam={selectedCalendarYearId}
        >
          <Suspense
            fallback={
              <p className='font-medium text-muted-foreground'>
                Loading table...
              </p>
            }
          >
            {selectedCalendarYear && (
              <div className='font-mono text-muted-foreground mb-3 text-sm'>
                {selectedCalendarYear.description} Income
              </div>
            )}

            <IncomeTableServer calendarYearId={selectedCalendarYearId} />
          </Suspense>
        </IncomeForm>
      </div>
    </main>
  );
}
