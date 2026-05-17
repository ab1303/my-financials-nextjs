import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { totalExpensesHandler } from '@/server/controllers/expense.controller';
import { getUserFiscalYearType } from '@/server/services/user-profile/user-profile.service';
import { auth } from '@/server/auth';
import { prisma } from '@/server/utils/prisma';
import { getDefaultCalendarYear } from '@/utils/calendar-year-defaults';

import ExpenseForm from './form';
import ExpenseTableServer from './ExpenseTableServer';

export const metadata: Metadata = {
  title: 'Expense Tracking | My Financials',
  description: 'Track and manage your monthly expenses across fiscal years',
};

// Next.js v15: searchParams is now a Promise
function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;
  return selected || '';
}

export default async function ExpensePage({
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
          Please log in to access expense tracking.
        </p>
      </div>
    );
  }

  const fromYearParam = +getSelectedParam(params?.fromYear);
  const toYearParam = +getSelectedParam(params?.toYear);
  const fiscalYearType = await getUserFiscalYearType(prisma, session.user.id);
  const calendarYears = await getCalendarYearsHandler([fiscalYearType ?? 'FISCAL']);

  const expenseYearData = calendarYears;

  const selectedCalendarYear =
    expenseYearData.find(
      (yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam,
    ) ||
    getDefaultCalendarYear(expenseYearData, fiscalYearType) ||
    expenseYearData[0];

  const selectedCalendarYearId = selectedCalendarYear
    ? selectedCalendarYear.id
    : '';

  const totalExpense = selectedCalendarYearId
    ? await totalExpensesHandler(selectedCalendarYearId, session.user.id)
    : 0;

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Monthly Expense Tracking
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Track and manage your monthly expenses across fiscal years
        </p>
      </div>
      <div className='rounded-xl border border-border bg-card shadow p-6'>
        {/* Fiscal Year Selection Form */}
        <div className='mb-6 pt-6'>
          <ExpenseForm
            expenseYearData={expenseYearData}
            selectedCalendarYear={selectedCalendarYear}
          />
        </div>

        {/* Total Expense Display */}
        {selectedCalendarYearId && (
          <div className='mb-6 p-4 bg-muted/50 border border-border rounded-lg'>
            <div className='flex justify-between items-center'>
              <span className='text-sm font-medium text-muted-foreground'>
                Total Expenses for {selectedCalendarYear?.description}:
              </span>
              <span className='text-lg font-bold text-foreground'>
                ${totalExpense?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>
        )}

        {/* Monthly Expense Table */}
        {selectedCalendarYearId && selectedCalendarYear ? (
          <Suspense fallback={<div>Loading expenses...</div>}>
            <ExpenseTableServer
              calendarYearId={selectedCalendarYearId}
              userId={session.user.id}
              dateFrom={
                new Date(
                  selectedCalendarYear.fromYear,
                  selectedCalendarYear.fromMonth - 1,
                  1,
                )
              }
              dateTo={
                new Date(
                  selectedCalendarYear.toYear,
                  selectedCalendarYear.toMonth,
                  0,
                  23,
                  59,
                  59,
                )
              }
              calendarLabel={selectedCalendarYear.description}
            />
          </Suspense>
        ) : (
          <div className='p-4 bg-yellow-50 border border-yellow-200 rounded-md'>
            <p className='text-yellow-800 font-medium'>No fiscal year found</p>
            <p className='text-yellow-600 text-sm mt-1'>
              Please create a fiscal year in Calendar Year management to start
              tracking expenses.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
