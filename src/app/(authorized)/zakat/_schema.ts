import { z } from 'zod';
import { BeneficiaryEnumType } from '@prisma/client';

export const FormDataSchema = z.object({
  calendarYearId: z.string().nonempty('Calendar year is required.'),
  totalAmount: z.number({ required_error: 'Total amount is required' }),
});

export type FormInput = z.infer<typeof FormDataSchema>;

// Zakat Payment Schemas
export const CreateZakatPaymentSchema = z.object({
  datePaid: z
    .date({
      required_error: 'Date paid is required',
    })
    .refine((date) => date <= new Date(), {
      message: 'Date paid cannot be in the future',
    }),
  amount: z
    .number({
      required_error: 'Amount is required',
    })
    .positive('Amount must be positive')
    .refine(
      (val) => Number(val.toFixed(2)) === val,
      'Amount can have at most 2 decimal places',
    ),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType, {
    required_error: 'Beneficiary type is required',
  }),
  beneficiaryId: z.string().optional(),
  calendarYearId: z.string().nonempty('Calendar year is required'),
  transactionId: z.string().optional(),
});

export const UpdateZakatPaymentSchema = z.object({
  id: z.string().nonempty('Payment ID is required'),
  datePaid: z.date().refine((date) => date <= new Date(), {
    message: 'Date paid cannot be in the future',
  }),
  amount: z
    .number()
    .positive('Amount must be positive')
    .refine(
      (val) => Number(val.toFixed(2)) === val,
      'Amount can have at most 2 decimal places',
    ),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().optional(),
});

export const DeleteZakatPaymentSchema = z.object({
  id: z.string().nonempty('Payment ID is required'),
});

export type CreateZakatPaymentInput = z.infer<typeof CreateZakatPaymentSchema>;
export type UpdateZakatPaymentInput = z.infer<typeof UpdateZakatPaymentSchema>;
export type DeleteZakatPaymentInput = z.infer<typeof DeleteZakatPaymentSchema>;
