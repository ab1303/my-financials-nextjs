import type { OptionType } from '@/types';
// import { server } from '@/server/trpc/server';
import { httpServer } from '@/server/trpc/server-http';

import Card from '@/components/card';
import BankInterestForm from './form';
import { bankInterestTableData } from './_hooks/useBankInterestTableData';

export default async function BanksPage() {
  const banks = await httpServer.bank.getAllBanks.query();
  const bankOptions: OptionType[] = banks
    ? banks.map((b) => ({
        id: b.id,
        label: b.name,
      }))
    : [];

  // TODO: needs to be an rpc call to fetch bankInterestData

  const bankInterestData = bankInterestTableData(1, 2023, 12, 2023);

  const initialData = {
    bankOptions,
    bankInterestData,
  };
  return (
    <>
      <Card.Header>
        <div className='flex justify-between mt-4 text-left'>
          <Card.Header.Title>Bank Interest Payout</Card.Header.Title>
        </div>
      </Card.Header>
      <div className='bg-white shadow mt-4 py-8 px-6 sm:px-10 rounded-lg'>
        <BankInterestForm initialData={initialData}></BankInterestForm>
      </div>
    </>
  );
}
