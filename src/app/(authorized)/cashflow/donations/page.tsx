import Head from 'next/head';
import { Suspense } from 'react';

import Card from '@/components/card';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import {
  createDonationYearHandler,
  donationHandler,
  totalDonationsHandler,
} from '@/server/controllers/donation.controller';

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
    (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam
  );

  const selectedCalendarYearId = selectedCalendarYear
    ? selectedCalendarYear.id
    : '';

  const donation = await donationHandler(selectedCalendarYearId);
  const totalDonations = await totalDonationsHandler(selectedCalendarYearId);

  const initialData = {
    donationYearData,
    totalDonations,
  };

  return (
    <>
      <Head>
        <title>Donations</title>
        <meta name='page' content='donations' />
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Donation Tracking</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <DonationForm
          initialData={initialData}
          yearIdParam={selectedCalendarYearId}
        >
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            <div className='font-mono text-gray-500 mb-3'>
              {selectedCalendarYear?.description} Donations
            </div>

            <DonationPaymentsTableServer calendarYearId={selectedCalendarYearId} />
          </Suspense>
        </DonationForm>
      </div>
    </>
  );
}