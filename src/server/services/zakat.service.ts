import { prisma } from '../utils/prisma';
import type {
  ZakatModel,
  ZakatPaymentModel,
  ZakatPaymentInput,
} from '../models/zakat';
import type { Prisma } from '@prisma/client';
import { deriveTaxCategory } from '../utils/charity-tax';

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
    beneficiaryType: zp.beneficiaryType,
    taxCategory: zp.taxCategory,
  }));
};

export const updateZakatPayment = async (
  model: ZakatPaymentInput,
  zakatPaymentId: string,
) => {
  // Derive tax category from beneficiary's DGR status
  const taxCategory = await deriveTaxCategory(
    model.beneficiaryId!,
    model.beneficiaryType
  );

  const where: Prisma.ZakatPaymentWhereUniqueInput = {
    id: zakatPaymentId,
  };

  await prisma.zakatPayment.update({
    where,
    data: {
      datePaid: model.datePaid,
      amount: model.amount,
      beneficiaryType: model.beneficiaryType,
      taxCategory,
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
  // Derive tax category from beneficiary's DGR status instead of requiring user input
  const taxCategory = await deriveTaxCategory(
    payment.beneficiaryId!,
    payment.beneficiaryType
  );

  return await prisma.zakatPayment.create({
    data: {
      zakatObligationId: zakatId,
      datePaid: payment.datePaid,
      amount: payment.amount,
      beneficiaryType: payment.beneficiaryType,
      taxCategory,
      businessId:
        payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
      individualId:
        payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
      transactionId: payment.transactionId || null,
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

  // Total deductible zakat payments
  const deductibleResult = await prisma.zakatPayment.aggregate({
    where: {
      ...baseWhere,
      taxCategory: 'DEDUCTIBLE',
    },
    _sum: {
      amount: true,
    },
  });

  // Total non-deductible zakat payments
  const nonDeductibleResult = await prisma.zakatPayment.aggregate({
    where: {
      ...baseWhere,
      taxCategory: 'NON_DEDUCTIBLE',
    },
    _sum: {
      amount: true,
    },
  });

  return {
    deductibleTotal: deductibleResult._sum.amount?.toNumber() ?? 0,
    nonDeductibleTotal: nonDeductibleResult._sum.amount?.toNumber() ?? 0,
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

