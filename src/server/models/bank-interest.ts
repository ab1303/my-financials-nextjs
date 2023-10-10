import type { PaymentModel } from './payment';

export type BankInterestModel = {
  id: string;
  month: number;
  year: number;
  bankId: string;
  amountDue: number;
  amountPaid: number;
  payments: PaymentModel[];
};
