import type { Prisma } from '@prisma/client';

import type {
  ZakatModel,
  ZakatPaymentInput,
  ZakatPaymentModel,
} from '../models/zakat';
import { prisma } from '../utils/prisma';

export const addZakatCalendarYearDetails = async ({
  calendarId,
  amountDue,
}: Omit<ZakatModel, 'id'>) => {
  return await prisma.zakatObligation.create({
    data: {
      calendarId,
      amountDue,
    },
  });
};

export const getZakat = async (calendarYearId: string): Promise<ZakatModel> => {
  const zakatPayment = await prisma.zakatObligation.findUnique({
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
    zakatObligation: {
      calendarId: calendarYearId,
    },
  };

  const zakatPayments = await prisma.zakatPayment.findMany({
    where,
    include: {
      business: true,
      individual: true,
      zakatObligation: true,
    },
  });

  return zakatPayments.map<ZakatPaymentModel>((zp) => ({
    id: zp.id,
    datePaid: zp.datePaid,
    amount: zp.amount.toNumber(),
    businessId: zp.businessId,
    individualId: zp.individualId,
    zakatObligationId: zp.zakatObligationId,
    transactionId: zp.transactionId ?? null,
    beneficiaryType: zp.beneficiaryType,
    isDeductible: zp.business?.isDgrRegistered === true,
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
  payment: Omit<ZakatPaymentInput, 'id' | 'zakatObligationId'> & { transactionId?: string },
) => {
  const created = await prisma.zakatPayment.create({
    data: {
      zakatObligationId: zakatId,
      datePaid: payment.datePaid,
      amount: payment.amount,
      beneficiaryType: payment.beneficiaryType,
      businessId:
        payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
      individualId:
        payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
      transactionId: payment.transactionId || null,
    },
    include: {
      business: true,
      individual: true,
    },
  });

  return {
    id: created.id,
    datePaid: created.datePaid,
    amount: created.amount.toNumber(),
    businessId: created.businessId,
    individualId: created.individualId,
    zakatObligationId: created.zakatObligationId,
    transactionId: created.transactionId ?? null,
    beneficiaryType: created.beneficiaryType,
    isDeductible: created.business?.isDgrRegistered === true,
  } satisfies ZakatPaymentModel;
};

export const deleteZakatPayment = async (zakatPaymentId: string) => {
  const existing = await prisma.zakatPayment.findUnique({
    where: { id: zakatPaymentId },
    select: { transactionId: true },
  });

  if (existing?.transactionId) {
    await prisma.zakatPayment.update({
      where: { id: zakatPaymentId },
      data: { transactionId: null },
    });
    return;
  }

  await prisma.zakatPayment.delete({
    where: { id: zakatPaymentId },
  });
};

/**
 * Gets zakat totals broken down by deductible status (DEDUCTIBLE, NON_DEDUCTIBLE)
 * for a fiscal year.
 */
export const getZakatTotalsByCategory = async (
  calendarYearId: string,
): Promise<{
  deductibleTotal: number;
  nonDeductibleTotal: number;
}> => {
  const baseWhere: Prisma.ZakatPaymentWhereInput = {
    zakatObligation: {
      calendarId: calendarYearId,
    },
  };

  const payments = await prisma.zakatPayment.findMany({
    where: baseWhere,
    select: {
      amount: true,
      business: { select: { isDgrRegistered: true } },
    },
  });

  let deductibleTotal = 0;
  let nonDeductibleTotal = 0;

  for (const payment of payments) {
    const amount = payment.amount.toNumber();
    if (payment.business?.isDgrRegistered === true) deductibleTotal += amount;
    else nonDeductibleTotal += amount;
  }

  return {
    deductibleTotal,
    nonDeductibleTotal,
  };
};

export async function getUnlinkedZakatTransactions(
  userId: string,
  fromYear: number,
  toYear: number,
): Promise<Array<{ id: string; date: string; description: string; amount: number }>> {
  const dateFrom = new Date(fromYear, 6, 1);
  const dateTo = new Date(toYear, 5, 30, 23, 59, 59);

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { equals: 'Gifts & donations', mode: 'insensitive' },
      date: { gte: dateFrom, lte: dateTo },
      zakatPayment: null,
    },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, description: true, amount: true },
  });

  return rows.map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString().slice(0, 10),
    description: tx.description,
    amount: Number(tx.amount),
  }));
}
