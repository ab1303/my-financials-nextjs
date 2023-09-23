import { useMemo } from 'react';

export type PaymentHistoryType = {
  id: number;
  amount: number;
  datePaid: Date;
  financialInstitutionId?: string;
};

export type BankInterestType = {
  month: number;
  year: number;
  amountDue: number;
  amountPaid: number;
  paymentHistory?: Array<PaymentHistoryType>;
};

// This data would come from backend through trpc call
const bankInterestData: BankInterestType[] = [
  {
    month: 1,
    year: 2023,
    amountDue: 150,
    amountPaid: 100,
    paymentHistory: [
      { id: 1, amount: 50, datePaid: new Date('15-Jan-2023') },
      { id: 2, amount: 75, datePaid: new Date('27-Jan-2023') },
    ],
  },
  {
    month: 2,
    year: 2023,
    amountDue: 150,
    amountPaid: 100,
  },
  {
    month: 3,
    year: 2023,
    amountDue: 170,
    amountPaid: 50,
    paymentHistory: [{ id: 3, amount: 50, datePaid: new Date('15-Mar-2023') }],
  },
  {
    month: 4,
    year: 2023,
    amountDue: 180,
    amountPaid: 50,
    paymentHistory: [{ id: 4, amount: 50, datePaid: new Date('15-Apr-2023') }],
  },
  {
    month: 5,
    year: 2023,
    amountDue: 190,
    amountPaid: 50,
    paymentHistory: [{ id: 5, amount: 50, datePaid: new Date('15-May-2023') }],
  },
  {
    month: 6,
    year: 2023,
    amountDue: 200,
    amountPaid: 50,
    paymentHistory: [{ id: 6, amount: 50, datePaid: new Date('15-Jun-2023') }],
  },
];

export default function useBankInterestTableData(
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number
) {
  return useMemo(() => {
    return bankInterestData
      .filter((d) => [fromYear, toYear].includes(d.year))
      .filter((d) => d.month >= fromMonth)
      .filter((d) => d.month <= toMonth);
  }, [fromMonth, fromYear, toMonth, toYear]);
}
