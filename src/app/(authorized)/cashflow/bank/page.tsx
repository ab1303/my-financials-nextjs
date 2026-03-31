import { Suspense } from 'react';
import type { Metadata } from 'next';

import { auth } from '@/server/auth';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';

import BankAssetsClient from './BankAssetsClient';

export const metadata: Metadata = {
  title: 'Bank Assets | My Financials',
  description: 'Track cash holdings across multiple bank accounts',
};

// Next.js v15: searchParams is now a Promise
function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;
  return selected || '';
}

export default async function BankAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // Get user session for user-specific data
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
        <p className='text-red-800 font-medium'>Authentication required</p>
        <p className='text-red-600 text-sm mt-1'>
          Please log in to access bank assets.
        </p>
      </div>
    );
  }

  const calendarTypeParam = getSelectedParam(params?.type) || 'FISCAL';
  const calendarYearIdParam = getSelectedParam(params?.yearId);

  // Get calendar years for the selector
  const calendarYears = await getCalendarYearsHandler();

  // Filter by selected type
  const filteredYears = calendarYears.filter(
    (cy) => cy.type === calendarTypeParam,
  );

  // Determine selected calendar year
  let selectedCalendarYear = filteredYears.find(
    (cy) => cy.id === calendarYearIdParam,
  );

  // Default to most recent if not specified
  if (!selectedCalendarYear && filteredYears.length > 0) {
    selectedCalendarYear = filteredYears[0];
  }

  const initialData = {
    calendarYears: filteredYears,
    selectedType: calendarTypeParam as 'FISCAL' | 'ANNUAL' | 'ZAKAT',
    selectedCalendarYearId: selectedCalendarYear?.id || '',
  };

  return (
    <main className='container mx-auto px-4 py-6 max-w-6xl'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Bank Assets — Cash Tracking
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage and track your bank account snapshots
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
        <Suspense
          fallback={
            <p className='font-medium text-muted-foreground'>Loading...</p>
          }
        >
          <BankAssetsClient initialData={initialData} />
        </Suspense>
      </div>
    </main>
  );
}
