import { CalendarEnumType } from '@prisma/client';
import {
  addCalendarYearDetails,
  getCalendarYears,
  updateCalendarYearDetails,
  deleteCalendarYearById,
  checkCalendarYearDeletability,
} from '../services/calendar-year.service';
import { handleCaughtError, handleDatabaseError } from '../utils/prisma';

export const createCalendarYearHandler = async (
  description: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  type: string,
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
    const errorResult = handleDatabaseError(e);
    return { calendarId: '', ...errorResult };
  }
};

export const getCalendarYearsHandler = async () => {
  const calendarYears = await getCalendarYears();
  return calendarYears;
};

export const updateCalendarYearHandler = async (
  id: string,
  description: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  type: string,
) => {
  const calendarType = CalendarEnumType[type as keyof typeof CalendarEnumType];

  try {
    const updatedCalendarYear = await updateCalendarYearDetails(id, {
      description,
      fromMonth,
      fromYear,
      toYear,
      toMonth,
      type: calendarType,
    });
    return { calendarId: updatedCalendarYear.id };
  } catch (e) {
    handleCaughtError(e);
    const errorResult = handleDatabaseError(e);
    return { calendarId: '', ...errorResult };
  }
};

export const deleteCalendarYearHandler = async (id: string) => {
  try {
    await deleteCalendarYearById(id);
    return { success: true };
  } catch (e) {
    handleCaughtError(e);
    return handleDatabaseError(e);
  }
};

export const checkCalendarYearDeletabilityHandler = async (id: string) => {
  try {
    const result = await checkCalendarYearDeletability(id);
    return { success: true, ...result };
  } catch (e) {
    handleCaughtError(e);
    return {
      success: false,
      error: 'Failed to check calendar year deletability',
    };
  }
};
