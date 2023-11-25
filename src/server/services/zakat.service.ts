import { prisma } from '../utils/prisma';
import type { ZakatModel, ZakatPaymentModel } from '../models/zakat';
import type { Prisma } from '@prisma/client';

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

export const getZakatPayments = async (
  calendarYearId: string
): Promise<Array<ZakatPaymentModel>> => {
  const where: Partial<Prisma.ZakatPaymentWhereInput> = {
    Zakat: {
      calendarId: calendarYearId,
    },
  };

  const zakatPayments = await prisma.zakatPayment.findMany({
    where,
    include: {
      business: true,
      Zakat: true,
    },
  });

  return zakatPayments.map<ZakatPaymentModel>((zp) => ({
    id: zp.id,
    datePaid: zp.datePaid,
    amount: zp.amount.toNumber(),
    businessId: zp.businessId,
    zakatId: zp.zakatId,
    beneficiaryType: zp.beneficiaryType,
  }));
};
