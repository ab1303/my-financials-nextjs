import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import type { BankInterestModel, PaymentModel } from '@/server/models';

export const getBankInterestDetails = async (
  bankId: string,
  year: number
): Promise<Array<BankInterestModel>> => {
  const where: Partial<Prisma.BankInterestWhereUniqueInput> = {
    bankId,
    year,
  };

  let bankInterstDetails = await prisma.bankInterest.findMany({
    where,
    include: {
      payments: true,
    },
  });

  if (!bankInterstDetails.length) {
    await createYearlyBankInterestDetails(bankId, year);
  }

  bankInterstDetails = await prisma.bankInterest.findMany({
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
  year: number,
  amountDue: number
) => {
  const where: Prisma.BankInterestWhereUniqueInput = {
    id,
    bankId,
    year,
  };

  await prisma.bankInterest.update({
    where,
    data: {
      amountDue,
    },
  });
};

export const addBankInterestPaymentDetail = async (
  bankInterestId: string,
  payment: Omit<PaymentModel, 'id'>
) => {
  return await prisma.bankInterest.update({
    where: { id: bankInterestId },
    data: {
      payments: {
        create: {
          amount: payment.amount,
          datePaid: payment.datePaid,
        },
      },
    },
    include: {
      payments: true,
    },
  });
};

export const updateBankInterestPaymentDetail = async (
  bankInterestId: string,
  paymentId: string,
  payment: number
) => {
  return await prisma.bankInterest.update({
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
  paymentId: string
) => {
  return await prisma.bankInterest.update({
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

const createYearlyBankInterestDetails = async (
  bankId: string,
  year: number
): Promise<number> => {
  const newBankInterestDetails: Array<Prisma.BankInterestCreateManyInput> = [];
  const calendarYear = await prisma.calendarYear.findFirstOrThrow({
    where: {
      fromYear: year,
      toYear: year,
      type: 'ANNUAL',
    },
  });

  for (let i = 1; i <= 12; ++i) {
    newBankInterestDetails.push({
      bankId,
      month: i,
      year,
      amountDue: 0.0,
      calendarId: calendarYear.id,
    });
  }

  const result = await prisma.bankInterest.createMany({
    data: newBankInterestDetails,
  });

  return result.count;
};
