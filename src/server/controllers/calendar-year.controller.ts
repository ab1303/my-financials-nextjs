import { CalendarEnumType } from '@prisma/client';
import { addCalendarYearDetails } from '../services/calendar-year.service';
import { handleCaughtError } from '../utils/prisma';

export const createCalendarYearHandler = async (
  description: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  type: string
) => {
  const calendarType =
    type === CalendarEnumType['ANNUAL']
      ? CalendarEnumType['ANNUAL']
      : type === CalendarEnumType['FISCAL']
      ? CalendarEnumType['FISCAL']
      : CalendarEnumType['ZAKAT'];

  try {
    const createCalendarYear = await addCalendarYearDetails({
      description,
      fromMonth,
      fromYear,
      toYear,
      toMonth,
      type: calendarType,
    });
    return { calendarId: createCalendarYear.id };
  } catch (e) {
    handleCaughtError(e);

    return { calendarId: '' };
  }
};
