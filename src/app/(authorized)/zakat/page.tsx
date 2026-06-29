import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import {
  createZakatYearHandler,
  zakatHandler,
  zakatTotalPaidHandler,
  zakatTotalsByBeneficiaryHandler,
  zakatTotalsByCategoryHandler,
} from '@/server/controllers/zakat.controller';

import UnlinkedZakatTransactionsBanner from './_components/UnlinkedZakatTransactionsBanner';
import ZakatBeneficiaryBreakdownWidget from './_components/ZakatBeneficiaryBreakdownWidget';
import type { FormInput } from './_schema';
import ZakatForm from './form';
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

  const beneficiaryId = getSelectedParam(params?.beneficiaryId) || undefined;

  const zakat = await zakatHandler(selectedCalendarYearId);
  const zakatTotals = await zakatTotalsByCategoryHandler(
    selectedCalendarYearId,
  );
  const beneficiaryBreakdown = await zakatTotalsByBeneficiaryHandler(
    selectedCalendarYearId,
  );
  const totalPaid = await zakatTotalPaidHandler(selectedCalendarYearId);

  const initialData = {
    zakatYearData,
    amountDue: zakat?.amountDue || 0,
    totalPaid,
    zakatTotals,
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
          {selectedCalendarYear && (
            <Suspense fallback={null}>
              <UnlinkedZakatTransactionsBanner
                fromYear={selectedCalendarYear.fromYear}
                toYear={selectedCalendarYear.toYear}
                dateFrom={`${selectedCalendarYear.fromYear}-01-01`}
                dateTo={`${selectedCalendarYear.toYear}-12-31`}
                calendarYearId={selectedCalendarYearId}
              />
            </Suspense>
          )}
          <ZakatBeneficiaryBreakdownWidget breakdown={beneficiaryBreakdown} />
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            <p className='text-sm font-semibold text-foreground mb-4'>
              {selectedCalendarYear?.description} Payments
            </p>

            <ZakatPaymentsTableServer
              calendarYearId={selectedCalendarYearId}
              beneficiaryId={beneficiaryId}
            />
          </Suspense>
        </ZakatForm>
      </div>
    </main>
  );
}
