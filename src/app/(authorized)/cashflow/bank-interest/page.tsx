export const dynamic = 'force-dynamic';

import type { CalendarEnumType } from '@prisma/client';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { auth } from '@/server/auth';
import { listBankAccountsHandler } from '@/server/controllers/bank-account.controller';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { prisma } from '@/server/db/client';
import { getYearlyCleansingData } from '@/server/services/interest-cleansing/interest-cleansing.service';
import { getUserFiscalYearType } from '@/server/services/user-profile/user-profile.service';
import type { OptionType } from '@/types';

import CleansingDonationsList from './_components/CleansingDonationsList';
import CreditsDialog from './_components/CreditsDialog';
import BankInterestFilters from './BankInterestFilters';

export const metadata: Metadata = {
  title: 'Bank Interest | My Financials',
  description: 'Track interest payments across bank accounts by year',
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
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
        <p className='text-red-800 font-medium'>Authentication required</p>
        <p className='text-red-600 text-sm mt-1'>
          Please log in to access bank interest tracking.
        </p>
      </div>
    );
  }

  const [allYearlyData, bankAccounts, fiscalYearType] = await Promise.all([
    getCalendarYearsHandler(['FISCAL', 'ANNUAL']),
    listBankAccountsHandler(session.user.id),
    getUserFiscalYearType(prisma, session.user.id),
  ]);
  const yearlyData = allYearlyData;
  // Bank options use user's FinancialAccount records (not global institution registry)
  const bankOptions: OptionType[] = bankAccounts.map((a) => ({
    id: a.id,
    label: `${a.name} (${a.institution.name})`,
  }));

  const yearIdParam = getSelectedParam(params?.year);

  const selectedBank = bankOptions.find(
    (b) => b.id === getSelectedParam(params?.bank),
  );
  const selectedBankId = selectedBank ? selectedBank.id : '';

  const selectedCalendarYearId = yearlyData.some((yd) => yd.id === yearIdParam)
    ? yearIdParam
    : '';

  const initialData = {
    bankOptions,
    yearlyData,
  };

  const yearlyCleansingData =
    selectedBankId && selectedCalendarYearId
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
    <main className='flex flex-col h-[calc(100vh-3.5rem-3rem)] px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6 shrink-0 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-foreground'>
            Bank Interest Payout
          </h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Track interest payments across bank accounts by year
          </p>
        </div>
        {selectedBankId && selectedCalendarYearId && (
          <CreditsDialog
            bankName={selectedBank?.label ?? ''}
            credits={yearlyCleansingData?.monthlyCredits ?? []}
          />
        )}
      </div>

      <div className='flex flex-col flex-1 rounded-xl border border-border bg-card shadow p-6 overflow-hidden'>
        <div className='shrink-0 mb-6'>
          <BankInterestFilters
            initialData={initialData}
            institutionIdParam={selectedBankId}
            yearIdParam={selectedCalendarYearId}
            defaultType={(fiscalYearType ?? 'FISCAL') as CalendarEnumType}
          />

          {selectedBankId && selectedCalendarYearId && (
            <div className='grid gap-4 md:grid-cols-3'>
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
          )}
        </div>

        <div className='flex-1 overflow-hidden'>
          <Suspense fallback={<p className='font-medium'>Loading...</p>}>
            {selectedBankId && selectedCalendarYearId ? (
              <div className='h-full overflow-y-auto'>
                <CleansingDonationsList
                  donations={yearlyCleansingData?.cleansingDonations ?? []}
                  yearlySummary={
                    yearlyCleansingData?.yearlySummary ?? {
                      totalReceived: 0,
                      totalCleansed: 0,
                      balance: 0,
                    }
                  }
                  institutionId={selectedBankId}
                  calendarYearId={selectedCalendarYearId}
                  dateFrom={yearlyCleansingData?.dateFrom ?? ''}
                  dateTo={yearlyCleansingData?.dateTo ?? ''}
                  unlinkedInterestCount={
                    yearlyCleansingData?.unlinkedInterestCount ?? 0
                  }
                />
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Please select a bank and year to view interest details.
              </p>
            )}
          </Suspense>
        </div>
      </div>
    </main>
  );
}
