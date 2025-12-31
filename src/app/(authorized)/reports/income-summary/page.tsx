import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Card from '@/components/card';
import { authOptions } from '@/utils/authOptions';
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const params = await searchParams;
  const userId = session.user.id;

  // Fetch all calendar years of type FISCAL
  const allCalendarYears = await getCalendarYearsHandler();
  const fiscalYears = allCalendarYears.filter((year) => year.type === 'FISCAL');

  return (
    <Card className='m-4 p-6'>
      <Card.Header>
        <Card.Header.Title>Income Summary</Card.Header.Title>
      </Card.Header>
      <Card.Body>
        <Suspense fallback={<div>Loading summary data...</div>}>
          <IncomeSummaryClient
            fiscalYears={fiscalYears}
            userId={userId}
            initialCalendarYearId={params.calendarYearId}
          />
        </Suspense>
      </Card.Body>
    </Card>
  );
}
