import { prisma } from '../utils/prisma';
import type {
  ZakatModel,
  ZakatPaymentModel,
  ZakatPaymentInput,
} from '../models/zakat';
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
  calendarYearId: string,
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
      individual: true,
      Zakat: true,
    },
  });

  return zakatPayments.map<ZakatPaymentModel>((zp) => ({
    id: zp.id,
    datePaid: zp.datePaid,
    amount: zp.amount.toNumber(),
    businessId: zp.businessId,
    individualId: zp.individualId,
    zakatId: zp.zakatId,
    beneficiaryType: zp.beneficiaryType,
  }));
};

export const updateZakatPayment = async (
  model: ZakatPaymentInput,
  zakatPaymentId: string,
) => {
  const where: Prisma.ZakatPaymentWhereUniqueInput = {
    id: zakatPaymentId,
  };

  await prisma.zakatPayment.update({
    where,
    data: {
      datePaid: model.datePaid,
      amount: model.amount,
      beneficiaryType: model.beneficiaryType,
      businessId:
        model.beneficiaryType === 'BUSINESS' ? model.beneficiaryId : null,
      individualId:
        model.beneficiaryType === 'INDIVIDUAL' ? model.beneficiaryId : null,
    },
  });
};

export const addZakatPaymentDetail = async (
  zakatId: string,
  payment: Omit<ZakatPaymentInput, 'id' | 'zakatId'>,
) => {
  return await prisma.zakatPayment.create({
    data: {
      zakatId,
      datePaid: payment.datePaid,
      amount: payment.amount,
      beneficiaryType: payment.beneficiaryType,
      businessId:
        payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
      individualId:
        payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
    },
  });
};

export const deleteZakatPayment = async (zakatPaymentId: string) => {
  await prisma.zakatPayment.delete({
    where: {
      id: zakatPaymentId,
    },
  });
};
