import type { Prisma, BankInterest } from '@prisma/client';
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

  let bankInterstDetails = (await prisma.bankInterest.findMany({
    where,
    include: {
      payments: true,
    },
  })) as Array<BankInterest>;

  if (!bankInterstDetails.length) {
    await createYearlyBankInterestDetails(bankId, year);
  }

  bankInterstDetails = (await prisma.bankInterest.findMany({
    where,
    include: {
      payments: true,
    },
  })) as Array<BankInterest>;

  return bankInterstDetails.map<BankInterestModel>((b) => ({
    id: b.id,
    bankId: b.bankId,
    month: b.month,
    year: b.year,
    amountDue: b.amountDue.toNumber(),
    amountPaid: b.amountPaid.toNumber(),
    payments: [],
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
  await prisma.payment.create({
    data: {
      bankInterestId,
      amount: payment.amount,
      datePaid: payment.datePaid,
      businessId: payment.businessId,
    },
  });
};

const createYearlyBankInterestDetails = async (
  bankId: string,
  year: number
): Promise<number> => {
  const newBankInterestDetails: Array<Prisma.BankInterestCreateManyInput> = [];
  for (let i = 1; i <= 12; ++i) {
    newBankInterestDetails.push({
      bankId,
      month: i,
      year,
      amountDue: 0.0,
      amountPaid: 0,
    });
  }

  const result = await prisma.bankInterest.createMany({
    data: newBankInterestDetails,
  });

  return result.count;
};
