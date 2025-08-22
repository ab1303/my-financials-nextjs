import { CalendarEnumType } from '@prisma/client';

export type ServerActionType = {
  success: boolean;
  error?: string;
  isReferentialIntegrityError?: boolean;
};

export type CalendarYearType = {
  id: string;
  type: CalendarEnumType | null;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
};

const CALENDAR_KEYS = Object.entries(CalendarEnumType).map(
  ([k]) => k as CalendarEnumType,
);

export { CALENDAR_KEYS };
