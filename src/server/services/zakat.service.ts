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

export const getZakat = async (calendarYearId: string): Promise<ZakatModel> => {
  const zakatPayment = await prisma.zakat.findUnique({
    where: { calendarId: calendarYearId },
  });

  if (!zakatPayment)
    return {
      id: '',
      amountDue: 0,
      calendarId: calendarYearId,
    };

  return {
    id: zakatPayment.id,
    amountDue: zakatPayment.amountDue.toNumber(),
    calendarId: zakatPayment.calendarId,
  };
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

export const updateZakatPayment = async (
  model: ZakatPaymentModel,
  zakatPaymentId: string
) => {
  const { datePaid, amount, beneficiaryType, businessId } = model;

  const where: Prisma.ZakatPaymentWhereUniqueInput = {
    id: zakatPaymentId,
  };

  await prisma.zakatPayment.update({
    where,
    data: {
      datePaid,
      amount,
      beneficiaryType,
      businessId,
    },
  });
};
