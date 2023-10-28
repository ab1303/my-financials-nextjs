import { prisma } from '../utils/prisma';
import type { CalendarYearModel } from '../models/calendarYear';

export const addCalendarYearDetails = async ({
  description,
  type,
  fromMonth,
  fromYear,
  toMonth,
  toYear,
}: Omit<CalendarYearModel, 'id'>) => {
  return await prisma.calendarYear.create({
    data: {
      description,
      type,
      fromMonth,
      fromYear,
      toMonth,
      toYear,
    },
  });
};

export const getCalendarYears = async () =>
  await prisma.calendarYear.findMany();
