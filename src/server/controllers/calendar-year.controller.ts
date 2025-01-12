import { CalendarEnumType } from '@prisma/client';
import {
  addCalendarYearDetails,
  getCalendarYears,
} from '../services/calendar-year.service';
import { handleCaughtError } from '../utils/prisma';

export const createCalendarYearHandler = async (
  description: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  type: string
) => {
  const calendarType = CalendarEnumType[type as keyof typeof CalendarEnumType];

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

export const getCalendarYearsHandler = async () => {
  const calendarYears = await getCalendarYears();
  return calendarYears;
};
