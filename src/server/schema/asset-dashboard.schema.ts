import { object, string, z } from 'zod';

export const getNetWorthTrendSchema = object({
  calendarYearId: string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type GetNetWorthTrendInput = z.infer<typeof getNetWorthTrendSchema>;
