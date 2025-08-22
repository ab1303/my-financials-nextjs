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

export const updateCalendarYearDetails = async (
  id: string,
  data: Omit<CalendarYearModel, 'id'>,
) => {
  return await prisma.calendarYear.update({
    where: { id },
    data: {
      description: data.description,
      type: data.type,
      fromMonth: data.fromMonth,
      fromYear: data.fromYear,
      toMonth: data.toMonth,
      toYear: data.toYear,
    },
  });
};

export const deleteCalendarYearById = async (id: string) => {
  return await prisma.calendarYear.delete({
    where: { id },
  });
};
