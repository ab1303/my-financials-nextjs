import type { TypeOf } from 'zod';
import { object, string, number, date } from 'zod';

// Bank Interest Payments
export const createBankInterestPaymentSchema = object({
  bankInterestId: string({ required_error: 'Bank interest month is required' }),
  businessId: string().nullable(),
  amount: number({ required_error: 'Amount is required' }),
  datePaid: date({ required_error: 'Date Paid is required' }),
});

export const createBankInterestPaymentOuputSchema = object({
  paymentId: string(),
});

// Bank Interest
export const getYearlyBankInterestSchema = object({
  bankId: string({ required_error: 'Bank is required' }).trim().min(5),
  year: number({ required_error: 'Fiscal year is required' }),
});

export const updateBankInterestSchema = object({
  bankId: string({ required_error: 'Bank is required' }),
  year: number({ required_error: 'Year is required' }),
  bankInterestId: string({ required_error: 'Bank interest month is required' }),
  amount: number({ required_error: 'Amount is required' }),
});

export type CreateBankInterestPaymentInput = TypeOf<
  typeof createBankInterestPaymentSchema
>;

export type CreateBankInterestPaymentOutput = TypeOf<
  typeof createBankInterestPaymentOuputSchema
>;

export type GetYearlyBankInterestPaymentInput = TypeOf<
  typeof getYearlyBankInterestSchema
>;

export type updateBankInterestPaymentInput = TypeOf<
  typeof updateBankInterestSchema
>;
