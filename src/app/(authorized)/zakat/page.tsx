import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import {
  createZakatYearHandler,
  zakatHandler,
} from '@/server/controllers/zakat.controller';

import ZakatForm from './form';
import type { FormInput } from './_schema';
import ZakatPaymentsTableServer from './ZakatTableServer';

export const metadata: Metadata = {
  title: 'Zakat',
  description: 'Zakat payment management',
};

// Next.js v15: searchParams is now a Promise
function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;
  return selected || '';
}

export default async function ZakatPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  async function addZakatCalendarYear(formData: FormInput) {
    'use server';

    const { calendarYearId, totalAmount } = formData;
    if (calendarYearId)
      await createZakatYearHandler(calendarYearId, totalAmount);

    return { success: true, error: null };
  }

  const fromYearParam = +getSelectedParam(params?.fromYear);
  const toYearParam = +getSelectedParam(params?.toYear);
  const calenderYears = await getCalendarYearsHandler();

  const zakatYearData = calenderYears.filter((yd) => yd.type === 'ZAKAT');
  const selectedCalendarYear = zakatYearData.find(
    (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam,
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
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Zakat Payments
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Manage zakat obligations and payment records by year
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
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
    </main>
  );
}
