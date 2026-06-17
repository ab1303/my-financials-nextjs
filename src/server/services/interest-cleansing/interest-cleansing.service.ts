import { prisma } from '@/server/db/client';
import {
  type InterestCleansingInput,
  type InterestCleansingModel,
} from './types';

export const getInterestCleansingPayments = async (
  calendarYearId: string,
  beneficiaryId?: string,
): Promise<Array<InterestCleansingModel>> => {
  const payments = await prisma.interestCleansing.findMany({
    where: {
      donationLedger: { calendarId: calendarYearId },
      ...(beneficiaryId ? { sourceBusinessId: beneficiaryId } : {}),
    },
    include: { sourceBusiness: true },
  });

  return payments.map(
    (ic): InterestCleansingModel => ({
      id: ic.id,
      datePaid: ic.datePaid,
      amount: ic.amount.toNumber(),
      sourceBusinessId: ic.sourceBusinessId,
      donationLedgerId: ic.donationLedgerId,
      transactionId: ic.creditTxId,
      isDeductible: ic.sourceBusiness?.isDgrRegistered === true,
      donationPurpose: 'INTEREST_CLEANSING',
    }),
  );
};

export const addInterestCleansingPayment = async (
  input: InterestCleansingInput,
) => {
  return await prisma.interestCleansing.create({
    data: {
      id: input.id,
      donationLedgerId: input.donationLedgerId,
      datePaid: input.datePaid,
      amount: input.amount,
      sourceBusinessId: input.sourceBusinessId,
      creditTxId: input.transactionId,
    },
  });
};

export const updateInterestCleansingPayment = async (
  id: string,
  input: InterestCleansingInput,
) => {
  return await prisma.interestCleansing.update({
    where: { id },
    data: {
      datePaid: input.datePaid,
      amount: input.amount,
      sourceBusinessId: input.sourceBusinessId,
      updatedAt: new Date(),
    },
  });
};

export const deleteInterestCleansingPayment = async (id: string) => {
  return await prisma.interestCleansing.delete({ where: { id } });
};
