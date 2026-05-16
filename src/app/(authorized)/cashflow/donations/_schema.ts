import { z } from 'zod';
import { BeneficiaryEnumType, DonationPurposeEnum } from '@prisma/client';

export const FormDataSchema = z.object({
  calendarYearId: z.string().nonempty('Calendar year is required.'),
});

export type FormInput = z.infer<typeof FormDataSchema>;

// Donation Payment Schemas
export const CreateDonationPaymentSchema = z.object({
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
  taxCategory: z.string().nonempty('Tax category is required'),
  beneficiaryId: z.string().nonempty('Please select a beneficiary'),
  transactionId: z.string().optional(),
  donationPurpose: z.nativeEnum(DonationPurposeEnum).optional().default('VOLUNTARY'),
  calendarYearId: z.string().nonempty('Calendar year is required.'),
});

export const UpdateDonationPaymentSchema = z.object({
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
  taxCategory: z.string().nonempty('Tax category is required'),
  beneficiaryId: z.string().nonempty('Please select a beneficiary'),
});

export const DeleteDonationPaymentSchema = z.object({
  id: z.string().nonempty('Payment ID is required'),
});

export type CreateDonationPaymentInput = z.input<
  typeof CreateDonationPaymentSchema
>;
export type UpdateDonationPaymentInput = z.infer<
  typeof UpdateDonationPaymentSchema
>;
export type DeleteDonationPaymentInput = z.infer<
  typeof DeleteDonationPaymentSchema
>;
