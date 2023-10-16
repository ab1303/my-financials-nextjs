import type { OptionType, YearType } from '@/types';
// import { server } from '@/server/trpc/server';
import { httpServer } from '@/server/trpc/server-http';

import Card from '@/components/card';
import BankInterestForm from './form';
import BankInterestTableServer from './BankInterestTableServer';
import { Suspense } from 'react';

type BankPageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

const yearlyData: Array<YearType> = [
  {
    id: '2021',
    type: 'annual',
    description: '2021',
    fromYear: 2021,
    fromMonth: 1,
    toYear: 2021,
    toMonth: 12,
  },
  {
    id: '2022',
    type: 'annual',
    description: '2022',
    fromYear: 2022,
    fromMonth: 1,
    toYear: 2022,
    toMonth: 12,
  },
  {
    id: '2021-2022',
    type: 'fiscal',
    description: '2021-2022',
    fromMonth: 7,
    fromYear: 2021,
    toMonth: 6,
    toYear: 2022,
  },
  {
    id: '2022-2023',
    type: 'fiscal',
    description: '2021-2022',
    fromMonth: 7,
    fromYear: 2022,
    toMonth: 6,
    toYear: 2023,
  },
];

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
  const banks = await httpServer.bank.getAllBanks.query();
  const bankOptions: OptionType[] = banks
    ? banks.map((b) => ({
        id: b.id,
        label: b.name,
      }))
    : [];

  const selectedBank = bankOptions.find(
    (b) => b.label === getSelectedParam(searchParams?.bank)
  );
  const selectedBankId = selectedBank ? selectedBank.id : '';
  const selectedYear = getSelectedParam(searchParams?.year);

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
          yearParam={selectedYear}
        >
          <Suspense fallback={<p className='font-medium'>Loading table...</p>}>
            <BankInterestTableServer
              bankId={selectedBankId}
              year={selectedYear}
            />
          </Suspense>
        </BankInterestForm>
      </div>
    </>
  );
}
