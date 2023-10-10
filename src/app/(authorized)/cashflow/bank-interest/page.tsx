import type { OptionType } from '@/types';
// import { server } from '@/server/trpc/server';
import { httpServer } from '@/server/trpc/server-http';

import Card from '@/components/card';
import BankInterestForm from './form';
import BankInterestTableServer from './BankInterestTableServer';

export default async function BanksPage() {
  const banks = await httpServer.bank.getAllBanks.query();
  const bankOptions: OptionType[] = banks
    ? banks.map((b) => ({
        id: b.id,
        label: b.name,
      }))
    : [];

  const initialData = {
    bankOptions,
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
          renderTableProp={async (bank, year) => {
            'use server';
            return <BankInterestTableServer bankId={bank} year={year} />;
          }}
        />
      </div>
    </>
  );
}
