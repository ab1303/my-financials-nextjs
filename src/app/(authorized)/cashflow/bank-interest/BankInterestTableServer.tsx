import BankInterestTableClient from './BankInterestTableClient';
import { httpServer } from '@/server/trpc/server-http';

import type { BankInterestModel } from '@/server/models';
import type { BankInterestType, PaymentHistoryType } from '@/types';

export type BankInterestTableServerProps = {
  bankId: string;
  year: string;
};

export default async function BankInterestTableServer({
  bankId,
  year,
}: BankInterestTableServerProps) {
  let bankInterestDetails: BankInterestModel[] | undefined = [];
  if (bankId && year) {
    bankInterestDetails = await httpServer.bankInterest.getYearlyBankInterestDetails.query(
      { bankId, year: +year }
    );
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
  return <BankInterestTableClient data={data} bankId={bankId} year={+year} />;
}
