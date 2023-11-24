export const dynamic = 'force-dynamic';

import type { OptionType } from '@/types';
// import { server } from '@/server/trpc/server';
import { httpServer } from '@/server/trpc/server-http';

import Card from '@/components/card';
import BankInterestForm from './form';
import BankInterestTableServer from './BankInterestTableServer';
import { Suspense } from 'react';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';

type BankPageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

function getSelectedParam(searchParam?: string | string[]) {
  const selectedSearch = searchParam || '';
  const selected = Array.isArray(selectedSearch)
    ? selectedSearch[0]
    : selectedSearch;

  return selected || '';
}

// page dynamically rendered
//https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional
export default async function BanksPage({ searchParams }: BankPageProps) {
  const yearlyData = (await getCalendarYearsHandler()).filter(
    (yd) => yd.type === 'ANNUAL'
  );

  const banks = await httpServer.bank.getAllBanks.query();
  const bankOptions: OptionType[] = banks
    ? banks.map((b) => ({
        id: b.id,
        label: b.name,
      }))
    : [];

  const yearParam = +getSelectedParam(searchParams?.year);

  const selectedBank = bankOptions.find(
    (b) => b.label === getSelectedParam(searchParams?.bank)
  );
  const selectedBankId = selectedBank ? selectedBank.id : '';

  const selectedCalendarYear = yearlyData.find(
    (yd) => yd.fromYear === yearParam && yd.toYear === yearParam
  );
  const selectedCalendarYearId = selectedCalendarYear
    ? selectedCalendarYear.id
    : '';

  const initialData = {
    bankOptions,
    yearlyData,
  };
  return (
    <>
      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Bank Interest Payout</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <BankInterestForm
          initialData={initialData}
          bankIdParam={selectedBankId}
          yearIdParam={selectedCalendarYearId}
        >
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            <div className='font-mono text-gray-500 mb-3'>
              {selectedBank?.label} Interest
            </div>

            <BankInterestTableServer
              bankId={selectedBankId}
              calendarYearId={selectedCalendarYearId}
            />
          </Suspense>
        </BankInterestForm>
      </div>
    </>
  );
}
