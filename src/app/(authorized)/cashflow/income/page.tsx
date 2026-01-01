import { Suspense } from 'react';
import type { Metadata } from 'next';

import Card from '@/components/card';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { totalIncomeHandler } from '@/server/controllers/income.controller';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/utils/authOptions';

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
  const session = await getServerSession(authOptions);
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
    <>
      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Income Tracking</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <IncomeForm
          initialData={initialData}
          yearIdParam={selectedCalendarYearId}
        >
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            {selectedCalendarYear && (
              <div className='font-mono text-gray-500 mb-3'>
                {selectedCalendarYear.description} Income
              </div>
            )}

            <IncomeTableServer calendarYearId={selectedCalendarYearId} />
          </Suspense>
        </IncomeForm>
      </div>
    </>
  );
}
