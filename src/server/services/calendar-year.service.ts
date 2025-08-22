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

export const checkCalendarYearDeletability = async (id: string) => {
  // Optional: Keep this for UI hints, but make it lightweight
  // Only check if calendar year exists and let DB handle constraints
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id },
    select: { id: true },
  });

  return {
    exists: !!calendarYear,
  };
};

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
  // Let the database handle referential integrity constraints
  // This will throw a P2003 error if there are foreign key constraints
  return await prisma.calendarYear.delete({
    where: { id },
  });
};
