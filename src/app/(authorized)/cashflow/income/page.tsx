import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { totalIncomeHandler } from '@/server/controllers/income.controller';
import { getUserFiscalYearType } from '@/server/services/user-profile/user-profile.service';
import { auth } from '@/server/auth';
import { prisma } from '@/server/utils/prisma';
import { getDefaultCalendarYear } from '@/utils/calendar-year-defaults';

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
  const fiscalYearType = await getUserFiscalYearType(prisma, session.user.id);
  const calendarYears = await getCalendarYearsHandler([fiscalYearType ?? 'FISCAL']);

  const incomeYearData = calendarYears;
  const urlSelectedYear = incomeYearData.find(
    (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam,
  );
  const defaultYear = getDefaultCalendarYear(incomeYearData, fiscalYearType);
  const selectedCalendarYear = urlSelectedYear ?? defaultYear;

  const selectedCalendarYearId = selectedCalendarYear?.id ?? '';
  const defaultCalendarYearId = defaultYear?.id ?? '';

  const totalIncome = await totalIncomeHandler(
    selectedCalendarYearId,
    session.user.id,
  );

  const initialData = {
    incomeYearData,
    totalIncome,
    defaultCalendarYearId,
  };

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
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
