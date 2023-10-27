import type { CalendarEnumType } from '@prisma/client';

export type CalendarYearModel = {
  id: string;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  type: CalendarEnumType;
};
