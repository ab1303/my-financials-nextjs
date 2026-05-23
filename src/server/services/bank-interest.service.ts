import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import type { BankInterestModel, PaymentModel } from '@/server/models';

export const getBankInterestDetails = async (
  bankId: string,
  calendarYearId: string,
): Promise<Array<BankInterestModel>> => {
  const where: Partial<Prisma.BankInterestLiabilityWhereUniqueInput> = {
    bankId,
    calendarId: calendarYearId,
  };

  let bankInterstDetails = await prisma.bankInterestLiability.findMany({
    where,
    include: {
      payments: true,
    },
  });

  if (!bankInterstDetails.length) {
    await createYearlyBankInterestDetails(bankId, calendarYearId);
  }

  bankInterstDetails = await prisma.bankInterestLiability.findMany({
    where,
    include: {
      payments: true,
    },
    orderBy: {
      month: 'asc',
    },
  });

  return bankInterstDetails.map<BankInterestModel>((b) => ({
    id: b.id,
    bankId: b.bankId,
    month: b.month,
    year: b.year,
    amountDue: b.amountDue.toNumber(),
    payments: b.payments.map((bp) => ({
      id: bp.id,
      businessId: bp.businessId,
      amount: bp.amount.toNumber(),
      datePaid: bp.datePaid,
    })),
  }));
};

export const updateBankInterestDetail = async (
  id: string,
  bankId: string,
  calendarYearId: string,
  amountDue: number,
) => {
  const where: Prisma.BankInterestLiabilityWhereUniqueInput = {
    id,
    bankId,
    calendarId: calendarYearId,
  };

  await prisma.bankInterestLiability.update({
    where,
    data: {
      amountDue,
    },
  });
};

/**
 * Create a single BankInterestLiability record for a specific month/year.
 * Used when user adds an override to a month that doesn't have a liability record yet.
 */
export const createSingleBankInterestLiability = async (
  bankId: string,
  calendarYearId: string,
  month: number,
  year: number,
  amountDue: number,
): Promise<string> => {
  const result = await prisma.bankInterestLiability.create({
    data: {
      bankId,
      calendarId: calendarYearId,
      month,
      year,
      amountDue,
    },
  });
  return result.id;
};

export const addBankInterestPaymentDetail = async (
  bankInterestId: string,
  payment: Omit<PaymentModel, 'id'>,
) => {
  return await prisma.bankInterestPayment.create({
    data: {
      bankInterestLiabilityId: bankInterestId,
      amount: payment.amount,
      datePaid: payment.datePaid,
    },
  });
};

export const updateBankInterestPaymentDetail = async (
  bankInterestId: string,
  paymentId: string,
  payment: number,
) => {
  return await prisma.bankInterestLiability.update({
    where: { id: bankInterestId },
    data: {
      payments: {
        update: {
          where: {
            id: paymentId,
          },
          data: {
            amount: payment,
          },
        },
      },
    },
    include: {
      payments: true,
    },
  });
};

export const removeBankInterestPaymentDetail = async (
  bankInterestId: string,
  paymentId: string,
) => {
  return await prisma.bankInterestLiability.update({
    where: { id: bankInterestId },
    data: {
      payments: {
        delete: {
          id: paymentId,
        },
      },
    },
    include: {
      payments: true,
    },
  });
};

export const initializeBankInterestYear = async (
  bankId: string,
  calendarYearId: string,
): Promise<void> => {
  const existing = await prisma.bankInterestLiability.findFirst({
    where: { bankId, calendarId: calendarYearId },
  });
  if (!existing) {
    await createYearlyBankInterestDetails(bankId, calendarYearId);
  }
};

const createYearlyBankInterestDetails = async (
  bankId: string,
  calendarYearId: string,
): Promise<number> => {
  const newBankInterestDetails: Array<Prisma.BankInterestLiabilityCreateManyInput> = [];

  console.log('Creating yearly bank interest details:', {
    bankId,
    calendarYearId,
    timestamp: new Date().toISOString(),
  });

  const calendarYear = await prisma.calendarYear.findUniqueOrThrow({
    where: {
      id: calendarYearId,
    },
  });

  // Create 12 monthly rows for the calendar year window
  // Supports both ANNUAL (Jan-Dec) and FISCAL (e.g., Jul-Jun) types
  const startYear = calendarYear.fromYear;
  const startMonth = calendarYear.fromMonth;
  const endYear = calendarYear.toYear;
  const endMonth = calendarYear.toMonth;

  let currentYear = startYear;
  let currentMonth = startMonth;

  for (let i = 1; i <= 12; ++i) {
    newBankInterestDetails.push({
      bankId,
      month: currentMonth,
      year: currentYear,
      amountDue: 0.0,
      calendarId: calendarYear.id,
    });

    // Advance to next month
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
  }

  const result = await prisma.bankInterestLiability.createMany({
    data: newBankInterestDetails,
  });

  return result.count;
};
