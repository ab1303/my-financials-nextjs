import { z } from 'zod';

export const FormDataSchema = z.object({
  calendarYearId: z.string().nonempty('Calendar year is required.'),
});

export type FormInput = z.infer<typeof FormDataSchema>;

// Income Entry Schemas
export const CreateIncomeEntrySchema = z.object({
  dateEarned: z
    .date({
      required_error: 'Date earned is required',
    })
    .refine((date) => date <= new Date(), {
      message: 'Date earned cannot be in the future',
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
  incomeSourceId: z.string().min(1, 'Income source is required'),
  calendarYearId: z.string().nonempty('Calendar year is required'),
});

export const UpdateIncomeEntrySchema = z.object({
  id: z.string().nonempty('Income entry ID is required'),
  dateEarned: z.date().refine((date) => date <= new Date(), {
    message: 'Date earned cannot be in the future',
  }),
  amount: z
    .number()
    .positive('Amount must be positive')
    .refine(
      (val) => Number(val.toFixed(2)) === val,
      'Amount can have at most 2 decimal places',
    ),
  incomeSourceId: z.string().min(1, 'Income source is required'),
});

export const DeleteIncomeEntrySchema = z.object({
  id: z.string().nonempty('Income entry ID is required'),
});

export type CreateIncomeEntryInput = z.infer<typeof CreateIncomeEntrySchema>;
export type UpdateIncomeEntryInput = z.infer<typeof UpdateIncomeEntrySchema>;
export type DeleteIncomeEntryInput = z.infer<typeof DeleteIncomeEntrySchema>;
