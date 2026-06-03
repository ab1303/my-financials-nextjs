import { prisma } from '../utils/prisma';
import type {
  DonationModel,
  DonationPaymentModel,
  DonationPaymentInput,
} from '../models/donation';
import type { Prisma } from '@prisma/client';

export const addDonationCalendarYearDetails = async ({
  calendarId,
}: Omit<DonationModel, 'id'>) => {
  return await prisma.donationLedger.create({
    data: {
      calendarId,
    },
  });
};

export const getDonation = async (
  calendarYearId: string,
): Promise<DonationModel> => {
  const donation = await prisma.donationLedger.findUnique({
    where: { calendarId: calendarYearId },
  });

  if (!donation)
    return {
      id: '',
      calendarId: calendarYearId,
    };

  return {
    id: donation.id,
    calendarId: donation.calendarId,
  };
};

export const getDonationPayments = async (
  calendarYearId: string,
): Promise<Array<DonationPaymentModel>> => {
  const where: Partial<Prisma.DonationPaymentWhereInput> = {
    donationLedger: {
      calendarId: calendarYearId,
    },
  };

  const donationPayments = await prisma.donationPayment.findMany({
    where,
    include: {
      business: true,
      individual: true,
      donationLedger: true,
    },
  });

  return donationPayments.map<DonationPaymentModel>((dp) => ({
    id: dp.id,
    datePaid: dp.datePaid,
    amount: dp.amount.toNumber(),
    businessId: dp.businessId,
    individualId: dp.individualId,
    donationLedgerId: dp.donationLedgerId,
    transactionId: dp.transactionId ?? null,
    beneficiaryType: dp.beneficiaryType,
    isDeductible: dp.business?.isDgrRegistered === true,
    donationPurpose: dp.donationPurpose,
  }));
};

export const updateDonationPayment = async (
  model: DonationPaymentInput,
  donationPaymentId: string,
) => {
  const where: Prisma.DonationPaymentWhereUniqueInput = {
    id: donationPaymentId,
  };

  await prisma.donationPayment.update({
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

export const addDonationPaymentDetail = async (
  donationLedgerId: string,
  payment: Omit<DonationPaymentInput, 'id' | 'donationLedgerId'>,
) => {
  const created = await prisma.donationPayment.create({
    data: {
      donationLedgerId,
      datePaid: payment.datePaid,
      amount: payment.amount,
      beneficiaryType: payment.beneficiaryType,
      businessId:
        payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
      individualId:
        payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
      transactionId: payment.transactionId ?? null,
      donationPurpose: payment.donationPurpose ?? 'VOLUNTARY',
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
    donationLedgerId: created.donationLedgerId,
    transactionId: created.transactionId ?? null,
    beneficiaryType: created.beneficiaryType,
    isDeductible: created.business?.isDgrRegistered === true,
    donationPurpose: created.donationPurpose,
  } satisfies DonationPaymentModel;
};

export const deleteDonationPayment = async (donationPaymentId: string) => {
  const existing = await prisma.donationPayment.findUnique({
    where: { id: donationPaymentId },
    select: { transactionId: true },
  });

  if (existing?.transactionId) {
    await prisma.donationPayment.update({
      where: { id: donationPaymentId },
      data: { transactionId: null },
    });
    return;
  }

  await prisma.donationPayment.delete({
    where: { id: donationPaymentId },
  });
};

export const getTotalDonations = async (
  calendarYearId: string,
): Promise<number> => {
  const result = await prisma.donationPayment.aggregate({
    where: {
      donationLedger: {
        calendarId: calendarYearId,
      },
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount?.toNumber() ?? 0;
};

/**
 * Gets donation totals broken down by purpose (VOLUNTARY, INTEREST_CLEANSING)
 * and deductible status (DEDUCTIBLE, NON_DEDUCTIBLE) for a fiscal year.
 */
export const getDonationTotalsByCategory = async (
  calendarYearId: string,
): Promise<{
  voluntaryTotal: number;
  interestCleansingTotal: number;
  deductibleTotal: number;
  nonDeductibleTotal: number;
}> => {
  const baseWhere: Prisma.DonationPaymentWhereInput = {
    donationLedger: {
      calendarId: calendarYearId,
    },
  };

  const payments = await prisma.donationPayment.findMany({
    where: baseWhere,
    select: {
      amount: true,
      donationPurpose: true,
      business: { select: { isDgrRegistered: true } },
    },
  });

  let voluntaryTotal = 0;
  let interestCleansingTotal = 0;
  let deductibleTotal = 0;
  let nonDeductibleTotal = 0;

  for (const payment of payments) {
    const amount = payment.amount.toNumber();
    const isDeductible = payment.business?.isDgrRegistered === true;

    if (payment.donationPurpose === 'VOLUNTARY') {
      voluntaryTotal += amount;
    } else if (payment.donationPurpose === 'INTEREST_CLEANSING') {
      interestCleansingTotal += amount;
    }

    if (isDeductible) deductibleTotal += amount;
    else nonDeductibleTotal += amount;
  }

  return {
    voluntaryTotal,
    interestCleansingTotal,
    deductibleTotal,
    nonDeductibleTotal,
  };
};
