import Head from 'next/head';
import { Suspense } from 'react';

import Card from '@/components/card';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import {
  createZakatYearHandler,
  zakatHandler,
} from '@/server/controllers/zakat.controller';

import ZakatForm from './form';
import type { FormInput } from './_schema';
import ZakatPaymentsTableServer from './ZakatTableServer';

type ZakatPageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;

  return selected || '';
}
export default async function ZakatPage({ searchParams }: ZakatPageProps) {
  async function addZakatCalendarYear(formData: FormInput) {
    'use server';

    const { calendarYearId, totalAmount } = formData;
    if (calendarYearId)
      await createZakatYearHandler(calendarYearId, totalAmount);

    return { success: true, error: null };
  }

  const fromYearParam = +getSelectedParam(searchParams?.fromYear);
  const toYearParam = +getSelectedParam(searchParams?.toYear);
  const calenderYears = await getCalendarYearsHandler();

  const zakatYearData = calenderYears.filter((yd) => yd.type === 'ZAKAT');
  const selectedCalendarYear = zakatYearData.find(
    (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam
  );

  const selectedCalendarYearId = selectedCalendarYear
    ? selectedCalendarYear.id
    : '';

  const zakat = await zakatHandler(selectedCalendarYearId);

  const initialData = {
    zakatYearData,
    amountDue: zakat?.amountDue || 0,
  };

  return (
    <>
      <Head>
        <title>Zakat</title>
        <meta name='page' content='zakat' />
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Zakat Payments</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <ZakatForm
          initialData={initialData}
          yearIdParam={selectedCalendarYearId}
          addZakatCalendarYear={addZakatCalendarYear}
        >
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            <div className='font-mono text-gray-500 mb-3'>
              {selectedCalendarYear?.description} Payments
            </div>

            <ZakatPaymentsTableServer calendarYearId={selectedCalendarYearId} />
          </Suspense>
        </ZakatForm>
      </div>
    </>
  );
}
