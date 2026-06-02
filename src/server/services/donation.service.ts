import { prisma } from '../utils/prisma';
import type {
  DonationModel,
  DonationPaymentModel,
  DonationPaymentInput,
} from '../models/donation';
import type { Prisma } from '@prisma/client';
import { deriveTaxCategory } from '../utils/charity-tax';

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
    taxCategory: dp.taxCategory,
    donationPurpose: dp.donationPurpose,
  }));
};

export const updateDonationPayment = async (
  model: DonationPaymentInput,
  donationPaymentId: string,
) => {
  // Derive tax category from beneficiary's DGR status
  const taxCategory = await deriveTaxCategory(
    model.beneficiaryId!,
    model.beneficiaryType
  );

  const where: Prisma.DonationPaymentWhereUniqueInput = {
    id: donationPaymentId,
  };

  await prisma.donationPayment.update({
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

export const addDonationPaymentDetail = async (
  donationLedgerId: string,
  payment: Omit<DonationPaymentInput, 'id' | 'donationLedgerId'>,
) => {
  // Derive tax category from beneficiary's DGR status instead of requiring user input
  const taxCategory = await deriveTaxCategory(
    payment.beneficiaryId!,
    payment.beneficiaryType
  );

  return await prisma.donationPayment.create({
    data: {
      donationLedgerId,
      datePaid: payment.datePaid,
      amount: payment.amount,
      beneficiaryType: payment.beneficiaryType,
      taxCategory,
      businessId:
        payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
      individualId:
        payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
      transactionId: payment.transactionId ?? null,
      donationPurpose: payment.donationPurpose ?? 'VOLUNTARY',
    },
  });
};

export const deleteDonationPayment = async (donationPaymentId: string) => {
  await prisma.donationPayment.delete({
    where: {
      id: donationPaymentId,
    },
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

  // Total voluntary donations
  const voluntaryResult = await prisma.donationPayment.aggregate({
    where: {
      ...baseWhere,
      donationPurpose: 'VOLUNTARY',
    },
    _sum: {
      amount: true,
    },
  });

  // Total interest cleansing donations
  const interestCleansingResult = await prisma.donationPayment.aggregate({
    where: {
      ...baseWhere,
      donationPurpose: 'INTEREST_CLEANSING',
    },
    _sum: {
      amount: true,
    },
  });

  // Total deductible donations
  const deductibleResult = await prisma.donationPayment.aggregate({
    where: {
      ...baseWhere,
      taxCategory: 'DEDUCTIBLE',
    },
    _sum: {
      amount: true,
    },
  });

  // Total non-deductible donations
  const nonDeductibleResult = await prisma.donationPayment.aggregate({
    where: {
      ...baseWhere,
      taxCategory: 'NON_DEDUCTIBLE',
    },
    _sum: {
      amount: true,
    },
  });

  return {
    voluntaryTotal: voluntaryResult._sum.amount?.toNumber() ?? 0,
    interestCleansingTotal: interestCleansingResult._sum.amount?.toNumber() ?? 0,
    deductibleTotal: deductibleResult._sum.amount?.toNumber() ?? 0,
    nonDeductibleTotal: nonDeductibleResult._sum.amount?.toNumber() ?? 0,
  };
};

