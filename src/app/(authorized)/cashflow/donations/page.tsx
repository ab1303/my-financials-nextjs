import { Suspense } from 'react';

import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { totalDonationsHandler } from '@/server/controllers/donation.controller';

import DonationForm from './form';
import DonationPaymentsTableServer from './DonationTableServer';

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

  const fromYearParam = +getSelectedParam(params?.fromYear);
  const toYearParam = +getSelectedParam(params?.toYear);
  const calenderYears = await getCalendarYearsHandler();

  const donationYearData = calenderYears.filter((yd) => yd.type === 'FISCAL');
  const selectedCalendarYear = donationYearData.find(
    (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam,
  );

  const selectedCalendarYearId = selectedCalendarYear
    ? selectedCalendarYear.id
    : '';

  const totalDonations = await totalDonationsHandler(selectedCalendarYearId);

  const initialData = {
    donationYearData,
    totalDonations,
  };

  return (
    <main className='container mx-auto px-4 py-6 max-w-6xl'>
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
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            {selectedCalendarYear && (
              <div className='font-mono text-gray-500 mb-3'>
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
