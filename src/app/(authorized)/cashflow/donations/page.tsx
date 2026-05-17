import { Suspense } from 'react';
import type { Metadata } from 'next';

import { auth } from '@/server/auth';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { totalDonationsHandler } from '@/server/controllers/donation.controller';
import { getUserFiscalYearType } from '@/server/services/user-profile/user-profile.service';
import { prisma } from '@/server/utils/prisma';
import { getDefaultCalendarYear } from '@/utils/calendar-year-defaults';

import DonationForm from './form';
import DonationPaymentsTableServer from './DonationTableServer';
import UnlinkedTransactionsBanner from './_components/UnlinkedTransactionsBanner';

export const metadata: Metadata = {
  title: 'Donation Tracking | My Financials',
  description: 'Monitor charitable giving and payment history by fiscal year',
};

// Next.js v15: searchParams is now a Promise
function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;
  return selected || '';
}

export default async function DonationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const session = await auth();

  const fromYearParam = +getSelectedParam(params?.fromYear);
  const toYearParam = +getSelectedParam(params?.toYear);
  const [donationYearData, fiscalYearType] = await Promise.all([
    getCalendarYearsHandler(['FISCAL']),
    session?.user?.id
      ? getUserFiscalYearType(prisma, session.user.id)
      : Promise.resolve(null),
  ]);

  const selectedCalendarYear =
    donationYearData.find(
      (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam,
    ) ?? getDefaultCalendarYear(donationYearData, fiscalYearType ?? 'FISCAL');

  const selectedCalendarYearId = selectedCalendarYear?.id ?? '';
  const defaultCalendarYearId = selectedCalendarYear?.id ?? '';

  const totalDonations = await totalDonationsHandler(selectedCalendarYearId);

  const initialData = {
    donationYearData,
    totalDonations,
    defaultCalendarYearId,
  };

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Donation Tracking
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Monitor charitable giving and payment history by fiscal year
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
        <DonationForm
          initialData={initialData}
          yearIdParam={selectedCalendarYearId}
        >
          {selectedCalendarYear && (
            <Suspense fallback={null}>
              <UnlinkedTransactionsBanner
                fromYear={selectedCalendarYear.fromYear}
                toYear={selectedCalendarYear.toYear}
                dateFrom={`${selectedCalendarYear.fromYear}-07-01`}
                dateTo={`${selectedCalendarYear.toYear}-06-30`}
                calendarYearId={selectedCalendarYearId}
              />
            </Suspense>
          )}
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            {selectedCalendarYear && (
              <div className='font-mono text-muted-foreground mb-3'>
                {selectedCalendarYear.description} Donations
              </div>
            )}

            <DonationPaymentsTableServer
              calendarYearId={selectedCalendarYearId}
            />
          </Suspense>
        </DonationForm>
      </div>
    </main>
  );
}
