export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';

import { auth } from '@/server/auth';
import { allBankDetailsHandler } from '@/server/controllers/bank.controller';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { getYearlyCleansingData } from '@/server/services/bank-interest/interest-cleansing.service';

import type { CalendarEnumType } from '@prisma/client';

import type { OptionType } from '@/types';

import BankInterestForm from './form';
import BankInterestTableServer from './BankInterestTableServer';

export const metadata: Metadata = {
  title: 'Bank Interest | My Financials',
};

function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;
  return selected || '';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}

export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const allYearlyData = await getCalendarYearsHandler();
  const yearlyData = allYearlyData.filter(
    (yd: { type: CalendarEnumType | null }) => yd.type === 'ANNUAL',
  );

  const banks = await allBankDetailsHandler();
  const bankOptions: OptionType[] = banks
    ? banks.map((b) => ({ id: b.id, label: b.name }))
    : [];

  const yearParamLabel = getSelectedParam(params?.year);

  const selectedBank = bankOptions.find(
    (b) => b.label === getSelectedParam(params?.bank),
  );
  const selectedBankId = selectedBank ? selectedBank.id : '';

  const selectedCalendarYear = yearlyData.find(
    (yd) => yd.description === yearParamLabel,
  );
  const selectedCalendarYearId = selectedCalendarYear
    ? selectedCalendarYear.id
    : '';

  const initialData = { bankOptions, yearlyData };

  const session = await auth();
  const yearlyCleansingData =
    selectedBankId && selectedCalendarYearId && session?.user?.id
      ? await getYearlyCleansingData(
          selectedBankId,
          selectedCalendarYearId,
          session.user.id,
        )
      : null;

  const totalReceived = yearlyCleansingData?.yearlySummary.totalReceived ?? 0;
  const totalCleansed = yearlyCleansingData?.yearlySummary.totalCleansed ?? 0;
  const remaining = yearlyCleansingData?.yearlySummary.balance ?? 0;

  return (
    <main className='container mx-auto max-w-6xl px-4 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Bank Interest Payout
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Track interest payments across bank accounts by year
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card p-6 shadow'>
        <BankInterestForm
          initialData={initialData}
          bankIdParam={selectedBankId}
          yearIdParam={selectedCalendarYearId}
        >
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            {selectedBankId && selectedCalendarYearId ? (
              <>
                <div className='mb-6 grid gap-4 md:grid-cols-3'>
                  <div className='rounded-lg border border-border bg-card p-4 shadow-sm dark:bg-card'>
                    <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                      Interest Received
                    </p>
                    <p className='mt-1 text-2xl font-bold tabular-nums text-foreground'>
                      {formatCurrency(totalReceived)}
                    </p>
                  </div>
                  <div className='rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-800 dark:bg-green-950'>
                    <p className='text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-300'>
                      Amount Cleansed
                    </p>
                    <p className='mt-1 text-2xl font-bold tabular-nums text-green-800 dark:text-green-200'>
                      {formatCurrency(totalCleansed)}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border p-4 shadow-sm ${
                      remaining > 0
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
                        : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                    }`}
                  >
                    <p
                      className={`text-xs font-medium uppercase tracking-wide ${
                        remaining > 0
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-green-700 dark:text-green-300'
                      }`}
                    >
                      Remaining to Cleanse
                    </p>
                    <p
                      className={`mt-1 text-2xl font-bold tabular-nums ${
                        remaining > 0
                          ? 'text-amber-800 dark:text-amber-200'
                          : 'text-green-800 dark:text-green-200'
                      }`}
                    >
                      {formatCurrency(remaining)}
                    </p>
                  </div>
                </div>
                <div className='mb-3 font-mono text-gray-500'>
                  {selectedBank?.label} Interest
                </div>
                {yearlyCleansingData ? (
                  <BankInterestTableServer
                    bankId={selectedBankId}
                    calendarYearId={selectedCalendarYearId}
                  />
                ) : null}
              </>
            ) : (
              <p className='text-sm text-gray-500'>
                Please select a bank and year to view interest details.
              </p>
            )}
          </Suspense>
        </BankInterestForm>
      </div>
    </main>
  );
}
