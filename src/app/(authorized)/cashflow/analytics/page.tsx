import type { CalendarEnumType } from '@prisma/client';
import type { Metadata } from 'next';

import { auth } from '@/server/auth';
import { listBankAccountsHandler } from '@/server/controllers/bank-account.controller';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import { getUserFiscalYearType } from '@/server/services/user-profile/user-profile.service';
import { prisma } from '@/server/utils/prisma';
import type { OptionType } from '@/types';
import { getDefaultCalendarYear } from '@/utils/calendar-year-defaults';

import CashflowAnalyticsClient from './_components/CashflowAnalyticsClient';

export const metadata: Metadata = {
  title: 'Cashflow Analytics | My Financials',
  description: 'Visualise income vs expenses trends and category breakdowns',
};

export default async function CashflowAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-800 font-medium">Authentication required</p>
      </div>
    );
  }

  const [calendarYears, bankAccounts, fiscalYearType] = await Promise.all([
    getCalendarYearsHandler(['FISCAL', 'ANNUAL']),
    listBankAccountsHandler(session.user.id),
    getUserFiscalYearType(prisma, session.user.id),
  ]);

  const defaultCalendarYear = getDefaultCalendarYear(calendarYears, fiscalYearType);

  const bankOptions: OptionType[] = bankAccounts.map((a) => ({
    id: a.id,
    label: `${a.name} (${a.institution.name})`,
  }));

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Cashflow Analytics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Income vs expenses trends, category breakdowns, and financial KPIs
        </p>
      </div>

      <CashflowAnalyticsClient
        calendarYears={calendarYears}
        defaultCalendarYearId={defaultCalendarYear?.id ?? ''}
        defaultCalendarType={(fiscalYearType ?? 'FISCAL') as CalendarEnumType}
        bankOptions={bankOptions}
      />
    </main>
  );
}
