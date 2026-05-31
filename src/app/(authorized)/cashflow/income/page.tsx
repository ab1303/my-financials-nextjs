import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { totalIncomeHandler } from '@/server/controllers/income.controller';
import { listBankAccountsHandler } from '@/server/controllers/bank-account.controller';
import { getUserFiscalYearType } from '@/server/services/user-profile/user-profile.service';
import { auth } from '@/server/auth';
import { prisma } from '@/server/utils/prisma';
import { getDefaultCalendarYear } from '@/utils/calendar-year-defaults';
import { UnresolvedTransfersBanner } from '@/components/UnresolvedTransfersBanner';
import { TransferExclusionSummary } from '@/components/TransferExclusionSummary';
import { TRANSFER_CATEGORY, ORPHAN_RESOLUTION_DAYS } from '@/server/services/transactions/constants';

import type { OptionType } from '@/types';
import type { CalendarEnumType } from '@prisma/client';

import IncomeForm from './form';
import IncomeTableServer from './IncomeTableServer';

export const metadata: Metadata = {
  title: 'Income Tracking | My Financials',
  description: 'Track and manage your income entries across fiscal years',
};

// Next.js v15: searchParams is now a Promise
function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;
  return selected || '';
}

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // Get user session for user-specific data
  const session = await auth();
  if (!session?.user?.id) {
    // Redirect to login or show error
    return (
      <div className='p-4 bg-red-50 border border-red-200 rounded-md'>
        <p className='text-red-800 font-medium'>Authentication required</p>
        <p className='text-red-600 text-sm mt-1'>
          Please log in to access income tracking.
        </p>
      </div>
    );
  }

  const yearIdParam = getSelectedParam(params?.year);
  const bankIdParam = getSelectedParam(params?.bank);
  const fiscalYearType = await getUserFiscalYearType(prisma, session.user.id);

  const [incomeYearData, bankAccounts] = await Promise.all([
    getCalendarYearsHandler(['FISCAL', 'ANNUAL']),
    listBankAccountsHandler(session.user.id),
  ]);

  const selectedCalendarYear =
    incomeYearData.find((yd) => yd.id === yearIdParam) ??
    getDefaultCalendarYear(incomeYearData, fiscalYearType);

  const selectedCalendarYearId = selectedCalendarYear?.id ?? '';

  // Derive selected bank account (user-scoped FinancialAccount, not global banks)
  const bankOptions: OptionType[] = bankAccounts.map((a) => ({
    id: a.id,
    label: `${a.name} (${a.institution.name})`,
  }));
  const selectedBankId = bankOptions.find((b) => b.id === bankIdParam)?.id ?? '';

  const totalIncome = await totalIncomeHandler(
    selectedCalendarYearId,
    session.user.id,
    selectedBankId || undefined,
  );

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ORPHAN_RESOLUTION_DAYS);

  const [orphanedCount, transferSummary] = await Promise.all([
    prisma.transaction.count({
      where: {
        userId: session.user.id,
        category: TRANSFER_CATEGORY,
        transferLinkedTransactionId: null,
        transferCounterpart: { is: null }, // exclude CREDIT sides of properly-linked pairs
        date: { lt: cutoffDate },
      },
    }),
    (async () => {
      const where = {
        userId: session.user.id,
        category: TRANSFER_CATEGORY,
        ...(selectedCalendarYear ? {
          date: {
            gte: new Date(selectedCalendarYear.fromYear, selectedCalendarYear.fromMonth - 1, 1),
            lte: new Date(selectedCalendarYear.toYear, selectedCalendarYear.toMonth, 0, 23, 59, 59),
          },
        } : {}),
      };
      const [count, agg] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      ]);
      return { count, totalAmount: Number(agg._sum.amount ?? 0) };
    })(),
  ]);

  const initialData = {
    incomeYearData,
    totalIncome,
    bankOptions,
    selectedBankId,
    defaultCalendarType: (fiscalYearType ?? 'FISCAL') as CalendarEnumType,
  };

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Income Tracking
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Track and manage your income entries across fiscal years
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
        <UnresolvedTransfersBanner
          count={orphanedCount}
          href="/cashflow/transactions?tab=transfers"
        />
        <TransferExclusionSummary
          count={transferSummary.count}
          totalAmount={transferSummary.totalAmount}
          href="/cashflow/transactions?tab=transfers"
        />
        <IncomeForm
          initialData={initialData}
          yearIdParam={selectedCalendarYearId}
        >
          <Suspense
            fallback={
              <p className='font-medium text-muted-foreground'>
                Loading table...
              </p>
            }
          >
            {selectedCalendarYear && (
              <h2 className='text-base font-semibold text-foreground mb-3'>
                {selectedCalendarYear.description} Income
              </h2>
            )}

            <IncomeTableServer calendarYearId={selectedCalendarYearId} bankAccountId={selectedBankId || undefined} />
          </Suspense>
        </IncomeForm>
      </div>
    </main>
  );
}
