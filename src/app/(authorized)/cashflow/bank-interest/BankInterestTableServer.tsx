import BankInterestTableClient from './BankInterestTableClient';
import { httpServer } from '@/server/trpc/server-http';

import type {
  BankInterestType,
  PaymentHistoryType,
} from './_hooks/useBankInterestTableData';

export type BankInterestTableServerProps = {
  bankId: string;
  year: number;
};

export default async function BankInterestTableServer({
  bankId,
  year,
}: BankInterestTableServerProps) {
  const bankInterestDetails = await httpServer.bankInterest.getYearlyBankInterestDetails.query(
    { bankId, year }
  );

  const data =
    bankInterestDetails?.map<BankInterestType>((d) => ({
      amountDue: d.amountDue,
      amountPaid: d.amountPaid,
      month: d.month,
      year: d.year,
      paymentHistory: d.payments.map<PaymentHistoryType>((p) => ({
        id: p.id,
        amount: p.amount,
        datePaid: p.datePaid,
        businessId: p.businessId || undefined,
      })),
    })) || [];
  return <BankInterestTableClient data={data} />;
}
