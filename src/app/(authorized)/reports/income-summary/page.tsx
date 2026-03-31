import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import IncomeSummaryClient from './IncomeSummaryClient';

export const metadata: Metadata = {
  title: 'Income Summary | My Financials',
  description:
    'Analyze income trends, monthly summaries, and source breakdowns',
};

type SearchParams = Promise<{
  calendarYearId?: string;
}>;

export default async function IncomeSummaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const params = await searchParams;
  const userId = session.user.id;

  // Fetch all calendar years of type FISCAL
  const allCalendarYears = await getCalendarYearsHandler();
  const fiscalYears = allCalendarYears.filter((year) => year.type === 'FISCAL');

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Income Summary
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Analyze income trends, monthly summaries, and source breakdowns
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
        <Suspense fallback={<div>Loading summary data...</div>}>
          <IncomeSummaryClient
            fiscalYears={fiscalYears}
            userId={userId}
            initialCalendarYearId={params.calendarYearId}
          />
        </Suspense>
      </div>
    </main>
  );
}
