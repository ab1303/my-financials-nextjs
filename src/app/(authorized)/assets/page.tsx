import type { Metadata } from 'next';
import { Suspense } from 'react';

import { auth } from '@/server/auth';
import Card from '@/components/card';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';

import NetWorthDashboardClient from './NetWorthDashboardClient';

export const metadata: Metadata = {
  title: 'Assets Overview | My Financials',
  description: 'Net worth trend across cash and stock assets',
};

export default async function AssetsOverviewPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className='rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/30'>
        <p className='font-medium text-red-800 dark:text-red-200'>
          Authentication required
        </p>
        <p className='mt-1 text-sm text-red-700 dark:text-red-300'>
          Please log in to access the assets dashboard.
        </p>
      </div>
    );
  }

  const calendarYears = await getCalendarYearsHandler();

  return (
    <>
      <Card.Header>
        <div className='mt-4 text-left'>
          <Card.Header.Title>Assets Overview</Card.Header.Title>
          <p className='mt-1 text-sm text-gray-600 dark:text-gray-300'>
            Net worth trend across cash and stock assets
          </p>
        </div>
      </Card.Header>
      <div className='mt-4 rounded-lg bg-white px-6 py-8 shadow dark:bg-gray-950 sm:px-10'>
        <Suspense
          fallback={
            <p className='text-sm text-gray-600 dark:text-gray-300'>Loading...</p>
          }
        >
          <NetWorthDashboardClient calendarYears={calendarYears} />
        </Suspense>
      </div>
    </>
  );
}
