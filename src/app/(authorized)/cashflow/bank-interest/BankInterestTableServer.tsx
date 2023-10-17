import BankInterestTableClient from './BankInterestTableClient';

import type { BankInterestModel } from '@/server/models';
import type { BankInterestType, PaymentHistoryType } from '@/types';
import { BankInterestStateProvider } from './StateProvider';
import { bankInterestDetailsHandler } from '@/server/controllers/bank-interest.controller';
import { getYearlyBankInterestSchema } from '@/server/schema/bank-interest.schema';

export type BankInterestTableServerProps = {
  bankId: string;
  year: string;
};

export default async function BankInterestTableServer({
  bankId,
  year,
}: BankInterestTableServerProps) {
  let bankInterestDetails: BankInterestModel[] | undefined = [];

  const validationResult = getYearlyBankInterestSchema.safeParse({
    bankId,
    year: +year,
  });

  if (validationResult.success) {
    bankInterestDetails = await bankInterestDetailsHandler(bankId, +year);
  }

  const data =
    bankInterestDetails?.map<BankInterestType>((d) => ({
      id: d.id,
      amountDue: d.amountDue,
      amountPaid: d.amountPaid,
      month: d.month,
      year: d.year,
      paymentHistory: d.payments.map<PaymentHistoryType>((p) => ({
        id: p.id,
        amount: p.amount,
        datePaid: p.datePaid,
        businessId: p.businessId,
      })),
    })) || [];

  return (
    <BankInterestStateProvider data={data}>
      <BankInterestTableClient bankId={bankId} year={+year} />
    </BankInterestStateProvider>
  );
}
