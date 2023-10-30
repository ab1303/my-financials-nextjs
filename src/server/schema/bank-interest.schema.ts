import type { TypeOf } from 'zod';
import { object, string, number, date } from 'zod';

// Bank Interest Payments
export const createBankInterestPaymentSchema = object({
  bankInterestId: string({ required_error: 'Bank interest id is required' }),
  businessId: string().nullable(),
  amount: number({ required_error: 'Amount is required' }),
  datePaid: date({ required_error: 'Date Paid is required' }),
});

export const updateBankInterestPaymentSchema = object({
  bankInterestId: string({ required_error: 'Bank interest id is required' }),
  paymentId: string({ required_error: 'Payment id is required' }),
  payment: number({ required_error: 'Payment amount is required' }),
});

export const removeBankInterestPaymentSchema = object({
  bankInterestId: string({ required_error: 'Bank interest id is required' }),
  paymentId: string({ required_error: 'Payment id is required' }),
});

export const createBankInterestPaymentOuputSchema = object({
  paymentId: string(),
});

// Bank Interest
export const getYearlyBankInterestSchema = object({
  bankId: string({ required_error: 'Bank is required' }).trim().min(5),
  calendarYearId: string({ required_error: 'Fiscal year is required' }),
});

export const updateBankInterestSchema = object({
  bankId: string({ required_error: 'Bank is required' }),
  calendarYearId: string({ required_error: 'Year is required' }),
  bankInterestId: string({ required_error: 'Bank interest id is required' }),
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
