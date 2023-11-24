import { prisma } from '../utils/prisma';
import type { ZakatModel } from '../models/zakat';

export const addZakatCalendarYearDetails = async ({
  calendarId,
  amountDue,
}: Omit<ZakatModel, 'id'>) => {
  return await prisma.zakat.create({
    data: {
      calendarId,
      amountDue,
    },
  });
};
