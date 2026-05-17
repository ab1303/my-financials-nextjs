import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { getUserFiscalYearType } from '@/server/services/user-profile/user-profile.service';
import { prisma } from '@/server/utils/prisma';
import { getDefaultCalendarYear } from '@/utils/calendar-year-defaults';
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

  const [allCalendarYears, fiscalYearType] = await Promise.all([
    getCalendarYearsHandler(['FISCAL', 'ANNUAL']),
    getUserFiscalYearType(prisma, userId),
  ]);
  const defaultYear = getDefaultCalendarYear(allCalendarYears, fiscalYearType);
  const initialCalendarYearId = params.calendarYearId ?? defaultYear?.id;

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
            fiscalYears={allCalendarYears}
            userId={userId}
            initialCalendarYearId={initialCalendarYearId}
          />
        </Suspense>
      </div>
    </main>
  );
}
