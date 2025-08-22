import { CalendarEnumType } from '@prisma/client';
import { z } from 'zod';

export const FormDataSchema = z.object({
  id: z.string().optional(),
  display: z.string().min(1, 'Display is required.'),
  fromDate: z.date({ required_error: 'From date is required' }),
  toDate: z.date({ required_error: 'To date is required' }),
  calendarType: z.enum(
    [CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL, CalendarEnumType.ZAKAT],
    { required_error: 'Calendar type is required' },
  ),
});

export type FormInput = z.infer<typeof FormDataSchema>;
