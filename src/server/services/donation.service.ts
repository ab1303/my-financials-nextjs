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
  return await prisma.donation.create({
    data: {
      calendarId,
    },
  });
};

export const getDonation = async (
  calendarYearId: string,
): Promise<DonationModel> => {
  const donation = await prisma.donation.findUnique({
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
    donation: {
      calendarId: calendarYearId,
    },
  };

  const donationPayments = await prisma.donationPayment.findMany({
    where,
    include: {
      business: true,
      individual: true,
      donation: true,
    },
  });

  return donationPayments.map<DonationPaymentModel>((dp) => ({
    id: dp.id,
    datePaid: dp.datePaid,
    amount: dp.amount.toNumber(),
    businessId: dp.businessId,
    individualId: dp.individualId,
    donationId: dp.donationId,
    beneficiaryType: dp.beneficiaryType,
    taxCategory: dp.taxCategory,
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
      taxCategory: model.taxCategory,
      businessId:
        model.beneficiaryType === 'BUSINESS' ? model.beneficiaryId : null,
      individualId:
        model.beneficiaryType === 'INDIVIDUAL' ? model.beneficiaryId : null,
    },
  });
};

export const addDonationPaymentDetail = async (
  donationId: string,
  payment: Omit<DonationPaymentInput, 'id' | 'donationId'>,
) => {
  return await prisma.donationPayment.create({
    data: {
      donationId,
      datePaid: payment.datePaid,
      amount: payment.amount,
      beneficiaryType: payment.beneficiaryType,
      taxCategory: payment.taxCategory,
      businessId:
        payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
      individualId:
        payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
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
      donation: {
        calendarId: calendarYearId,
      },
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount?.toNumber() ?? 0;
};
