import { z } from 'zod';

export const FormDataSchema = z.object({
  calendarYearId: z.string().nonempty('Calendar year is required.'),
});

export type FormInput = z.infer<typeof FormDataSchema>;

// Expense Entry Schemas
export const CreateExpenseEntrySchema = z.object({
  month: z
    .number({
      required_error: 'Month is required',
    })
    .int('Month must be an integer')
    .min(1, 'Month must be between 1 and 12')
    .max(12, 'Month must be between 1 and 12'),
  amount: z
    .number({
      required_error: 'Amount is required',
    })
    .positive('Amount must be positive')
    .refine(
      (val) => Number(val.toFixed(2)) === val,
      'Amount can have at most 2 decimal places',
    ),
  categoryId: z.string().uuid('Invalid category'),
  calendarYearId: z.string().nonempty('Calendar year is required'),
});

export const UpdateExpenseEntrySchema = z.object({
  id: z.string().nonempty('Expense entry ID is required'),
  month: z
    .number()
    .int('Month must be an integer')
    .min(1, 'Month must be between 1 and 12')
    .max(12, 'Month must be between 1 and 12')
    .optional(),
  amount: z
    .number()
    .positive('Amount must be positive')
    .refine(
      (val) => Number(val.toFixed(2)) === val,
      'Amount can have at most 2 decimal places',
    )
    .optional(),
  categoryId: z.string().uuid('Invalid category').optional(),
});

export const DeleteExpenseEntrySchema = z.object({
  id: z.string().nonempty('Expense entry ID is required'),
  calendarYearId: z.string().nonempty('Calendar year is required'),
});

export type CreateExpenseEntryInput = z.infer<typeof CreateExpenseEntrySchema>;
export type UpdateExpenseEntryInput = z.infer<typeof UpdateExpenseEntrySchema>;
export type DeleteExpenseEntryInput = z.infer<typeof DeleteExpenseEntrySchema>;
