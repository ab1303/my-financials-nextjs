import type { TypeOf } from 'zod';
import { object, string, number, date } from 'zod';

export const createBankInterestPaymentSchema = object({
  bankInterestId: string({ required_error: 'Bank interest month is required' }),
  amount: number({ required_error: 'Amount is required' }),
  datePaid: date({ required_error: 'Date Paid is required' }),
});

export const getYearlyBankInterestPaymentSchema = object({
  bankId: string({ required_error: 'Bank is required' }),
  year: number({ required_error: 'Fiscal year is required' }),
});

export type CreateBankInterestPaymentInput = TypeOf<
  typeof createBankInterestPaymentSchema
>;

export type GetYearlyBankInterestPaymentInput = TypeOf<
  typeof getYearlyBankInterestPaymentSchema
>;
