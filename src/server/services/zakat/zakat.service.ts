import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';

import {
  DONATION_PURPOSES,
  getAllLinkedTransactionIds,
} from '@/server/services/transactions/donation-utils.service';

import {
  type ZakatModel,
  type ZakatPaymentInput,
  type ZakatPaymentModel,
} from './types';

export const getZakatPayments = async (
  calendarYearId: string,
  beneficiaryId?: string,
): Promise<Array<ZakatPaymentModel>> => {
  const payments = await prisma.zakatPayment.findMany({
    where: {
      zakatObligation: { calendarId: calendarYearId },
      ...(beneficiaryId
        ? {
            OR: [
              { businessId: beneficiaryId },
              { individualId: beneficiaryId },
            ],
          }
        : {}),
    },
    include: { business: true, individual: true },
  });

  return payments.map(
    (zp): ZakatPaymentModel => ({
      id: zp.id,
      datePaid: zp.datePaid,
      amount: zp.amount.toNumber(),
      businessId: zp.businessId,
      individualId: zp.individualId,
      zakatObligationId: zp.zakatObligationId,
      transactionId: zp.transactionId,
      beneficiaryType: zp.beneficiaryType,
      isDeductible: zp.business?.isDgrRegistered === true,
      donationPurpose: 'ZAKAT',
    }),
  );
};

export const addZakatPayment = async (input: ZakatPaymentInput) => {
  return await prisma.zakatPayment.create({
    data: {
      id: input.id,
      datePaid: input.datePaid,
      amount: input.amount,
      beneficiaryType: input.beneficiaryType,
      businessId:
        input.beneficiaryType === 'BUSINESS' ? input.beneficiaryId : null,
      individualId:
        input.beneficiaryType === 'INDIVIDUAL' ? input.beneficiaryId : null,
      zakatObligationId: input.zakatObligationId,
      transactionId: input.transactionId,
    },
  });
};

export const updateZakatPayment = async (
  id: string,
  input: ZakatPaymentInput,
) => {
  return await prisma.zakatPayment.update({
    where: { id },
    data: {
      datePaid: input.datePaid,
      amount: input.amount,
      beneficiaryType: input.beneficiaryType,
      businessId:
        input.beneficiaryType === 'BUSINESS' ? input.beneficiaryId : null,
      individualId:
        input.beneficiaryType === 'INDIVIDUAL' ? input.beneficiaryId : null,
      updatedAt: new Date(),
    },
  });
};

export const deleteZakatPayment = async (id: string) => {
  return await prisma.zakatPayment.delete({ where: { id } });
};

export const getLinkedTransactionIds = async (): Promise<string[]> => {
  const linked = await prisma.zakatPayment.findMany({
    where: { transactionId: { not: null } },
    select: { transactionId: true },
  });
  return linked.map((d) => d.transactionId!);
};

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

export const updateZakatObligation = async (
  zakatObligationId: string,
  amountDue: number,
) => {
  return await prisma.zakatObligation.update({
    where: { id: zakatObligationId },
    data: { amountDue },
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

export const getZakatTotalPaid = async (
  calendarYearId: string,
): Promise<number> => {
  const payments = await prisma.zakatPayment.findMany({
    where: { zakatObligation: { calendarId: calendarYearId } },
    select: { amount: true },
  });

  return payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
};

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

export const getZakatTotalsByBeneficiary = async (
  calendarYearId: string,
): Promise<Array<{ id: string; name: string; total: number }>> => {
  const zakatPayments = await prisma.zakatPayment.findMany({
    where: { zakatObligation: { calendarId: calendarYearId } },
    select: {
      amount: true,
      business: { select: { id: true, name: true } },
      individual: { select: { id: true, name: true } },
    },
  });

  const beneficiaryTotals: Record<
    string,
    { id: string; name: string; total: number }
  > = {};

  zakatPayments.forEach((payment) => {
    const amount = payment.amount.toNumber();
    const entity = payment.business ?? payment.individual;
    const id = entity?.id ?? 'unknown';
    const name = entity?.name ?? 'Unknown';

    if (!beneficiaryTotals[id]) {
      beneficiaryTotals[id] = { id, name, total: 0 };
    }
    beneficiaryTotals[id].total += amount;
  });

  return Object.values(beneficiaryTotals);
};

export async function getUnlinkedZakatTransactions(
  userId: string,
  fromYear: number,
  toYear: number,
): Promise<
  Array<{ id: string; date: string; description: string; amount: number }>
> {
  const dateFrom = new Date(fromYear, 6, 1);
  const dateTo = new Date(toYear, 5, 30, 23, 59, 59);

  const [rows, allLinkedTxIds] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        type: 'DEBIT',
        status: 'CONFIRMED',
        category: { equals: 'Gifts & donations', mode: 'insensitive' },
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { date: 'desc' },
      select: { id: true, date: true, description: true, amount: true },
    }),
    getAllLinkedTransactionIds([
      DONATION_PURPOSES.VOLUNTARY,
      DONATION_PURPOSES.INTEREST_CLEANSING,
      DONATION_PURPOSES.ZAKAT,
    ]),
  ]);

  return rows
    .filter((tx) => !allLinkedTxIds.has(tx.id))
    .map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString().slice(0, 10),
      description: tx.description,
      amount: Number(tx.amount),
    }));
}

export const addZakatPaymentDetail = async (
  zakatId: string,
  payment: Omit<ZakatPaymentInput, 'id' | 'zakatObligationId'> & {
    transactionId?: string;
  },
): Promise<ZakatPaymentModel> => {
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
    donationPurpose: 'ZAKAT',
  } satisfies ZakatPaymentModel;
};
