import { z } from 'zod';

export const FormDataSchema = z.object({
  calendarYearId: z.string().nonempty('Calendar year is required.'),
  totalAmount: z.number({ required_error: 'Total amount is required' }),
});

export type FormInput = z.infer<typeof FormDataSchema>;
