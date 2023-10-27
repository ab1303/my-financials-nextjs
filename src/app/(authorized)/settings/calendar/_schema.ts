import { z } from 'zod';
import { CALENDAR_MAP } from './_types';

export const FormDataSchema = z.object({
  display: z.string().nonempty('Display is required.'),
  fromDate: z.date({ required_error: 'From date is required' }),
  toDate: z.date({ required_error: 'To date is required' }),
  calendarType: z.enum(
    [CALENDAR_MAP.ANNUAL, CALENDAR_MAP.FISCAL, CALENDAR_MAP.ZAKAT],
    { required_error: 'Calendar type is required' }
  ),
});

export type FormInput = z.infer<typeof FormDataSchema>;
