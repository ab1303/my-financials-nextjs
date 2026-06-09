import type { Prisma } from '@prisma/client';

import { env } from '../../env/server.mjs';
import type {
  DonationModel,
  DonationPaymentInput,
  DonationPaymentModel,
} from '../models/donation';
import { prisma } from '../utils/prisma';

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
  const voluntaryDonations = await prisma.voluntaryDonation.findMany({
    where: {
      donationLedger: {
        calendarId: calendarYearId,
      },
    },
    include: {
      business: true,
      individual: true,
    },
  });

  return voluntaryDonations.map<DonationPaymentModel>((vd) => ({
    id: vd.id,
    datePaid: vd.datePaid,
    amount: vd.amount.toNumber(),
    businessId: vd.businessId,
    individualId: vd.individualId,
    donationLedgerId: vd.donationLedgerId,
    transactionId: vd.transactionId,
    beneficiaryType: vd.beneficiaryType,
    isDeductible: vd.business?.isDgrRegistered === true,
    donationPurpose: vd.purpose,
  }));
};

export const updateDonationPayment = async (
  model: DonationPaymentInput,
  donationPaymentId: string,
) => {
  await prisma.$transaction(async (tx) => {
    // Determine purpose based on existing record
    const existing = await tx.donationPayment.findUnique({
      where: { id: donationPaymentId },
      select: { donationPurpose: true },
    });
    if (!existing) throw new Error('Donation payment not found');

    const updateData = {
      datePaid: model.datePaid,
      amount: model.amount,
      beneficiaryType: model.beneficiaryType,
      businessId:
        model.beneficiaryType === 'BUSINESS' ? model.beneficiaryId : null,
      individualId:
        model.beneficiaryType === 'INDIVIDUAL' ? model.beneficiaryId : null,
      updatedAt: new Date(),
    };

    if (existing.donationPurpose === 'VOLUNTARY') {
      await tx.voluntaryDonation.update({
        where: { id: donationPaymentId },
        data: updateData,
      });
    } else if (existing.donationPurpose === 'INTEREST_CLEANSING') {
      await tx.interestCleansing.update({
        where: { id: donationPaymentId },
        data: {
          datePaid: updateData.datePaid,
          amount: updateData.amount,
          sourceBusinessId: updateData.businessId,
        },
      });
    } else if (existing.donationPurpose === 'ZAKAT') {
      await tx.zakatPayment.update({
        where: { id: donationPaymentId },
        data: updateData,
      });
    }
  });
};

export const addDonationPaymentDetail = async (
  donationLedgerId: string,
  payment: Omit<DonationPaymentInput, 'donationLedgerId'>,
) => {
  const created = await prisma.$transaction(async (tx) => {
    const purpose = payment.donationPurpose ?? 'VOLUNTARY';
    const id = payment.id; // Allow id to be passed

    if (purpose === 'VOLUNTARY') {
      return await tx.voluntaryDonation.create({
        data: {
          id,
          donationLedgerId,
          datePaid: payment.datePaid,
          amount: payment.amount,
          beneficiaryType: payment.beneficiaryType,
          businessId:
            payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
          individualId:
            payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
          purpose: 'VOLUNTARY',
          transactionId: payment.transactionId,
        },
      });
    } else if (purpose === 'INTEREST_CLEANSING') {
      return await tx.interestCleansing.create({
        data: {
          id,
          donationLedgerId,
          datePaid: payment.datePaid,
          amount: payment.amount,
          sourceBusinessId:
            payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
          creditTxId: payment.transactionId,
        },
      });
    } else if (purpose === 'ZAKAT') {
      return await tx.zakatPayment.create({
        data: {
          id,
          datePaid: payment.datePaid,
          amount: payment.amount,
          beneficiaryType: payment.beneficiaryType,
          businessId:
            payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
          individualId:
            payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
          zakatObligationId: donationLedgerId,
          transactionId: payment.transactionId,
        },
      });
    }
    throw new Error('Unsupported donation purpose');
  });

  // Re-fetch to return the expected DTO shape
  const record = await prisma.voluntaryDonation.findUnique({
    where: { id: created.id },
    include: { business: true, individual: true },
  }) ?? await prisma.zakatPayment.findUnique({
    where: { id: created.id },
    include: { business: true, individual: true },
  }) ?? await prisma.interestCleansing.findUnique({
    where: { id: created.id },
    include: { sourceBusiness: true },
  });

  if (!record) throw new Error('Failed to retrieve created donation');
  
  // Mapping logic to reconstruct DonationPaymentModel
  return {
    id: record.id,
    datePaid: record.datePaid,
    amount: record.amount.toNumber(),
    businessId: 'businessId' in record ? record.businessId : ('sourceBusinessId' in record ? record.sourceBusinessId : null),
    individualId: 'individualId' in record ? record.individualId : undefined,
    donationLedgerId: 'donationLedgerId' in record ? record.donationLedgerId : null,
    transactionId: 'transactionId' in record ? record.transactionId : ('creditTxId' in record ? record.creditTxId : null),
    beneficiaryType: 'beneficiaryType' in record ? record.beneficiaryType : 'BUSINESS',
    isDeductible: ('business' in record && record.business?.isDgrRegistered === true) || ('sourceBusiness' in record && record.sourceBusiness?.isDgrRegistered === true),
    donationPurpose: 'purpose' in record ? record.purpose : ('zakatObligationId' in record ? 'ZAKAT' : 'INTEREST_CLEANSING'),
  } satisfies DonationPaymentModel;
};

export const deleteDonationPayment = async (donationPaymentId: string) => {
  await prisma.$transaction(async (tx) => {
    // Attempt deletion from all potential models
    await tx.voluntaryDonation.delete({ where: { id: donationPaymentId } }).catch(() => {});
    await tx.interestCleansing.delete({ where: { id: donationPaymentId } }).catch(() => {});
    await tx.zakatPayment.delete({ where: { id: donationPaymentId } }).catch(() => {});
  });
};

export const getTotalDonations = async (
  calendarYearId: string,
): Promise<number> => {
  const [voluntary, zakat, interest] = await Promise.all([
    prisma.voluntaryDonation.aggregate({
      where: { donationLedger: { calendarId: calendarYearId } },
      _sum: { amount: true },
    }),
    prisma.zakatPayment.aggregate({
      where: { zakatObligation: { calendarId: calendarYearId } },
      _sum: { amount: true },
    }),
    prisma.interestCleansing.aggregate({
      where: { donationLedger: { calendarId: calendarYearId } },
      _sum: { amount: true },
    }),
  ]);

  return (
    (voluntary._sum.amount?.toNumber() ?? 0) +
    (zakat._sum.amount?.toNumber() ?? 0) +
    (interest._sum.amount?.toNumber() ?? 0)
  );
};

/**
 * Gets donation totals broken down by purpose (VOLUNTARY, INTEREST_CLEANSING)
 * and deductible status (DEDUCTIBLE, NON_DEDUCTIBLE) for a fiscal year.
 */
export const getDonationTotalsByCategory = async (
  calendarYearId: string,
): Promise<{
  voluntaryTotal: number;
  deductibleTotal: number;
  nonDeductibleTotal: number;
}> => {
  const voluntaryDonations = await prisma.voluntaryDonation.findMany({
    where: {
      donationLedger: {
        calendarId: calendarYearId,
      },
    },
    select: {
      amount: true,
      business: { select: { isDgrRegistered: true } },
    },
  });

  let voluntaryTotal = 0;
  let deductibleTotal = 0;
  let nonDeductibleTotal = 0;

  for (const payment of voluntaryDonations) {
    const amount = payment.amount.toNumber();
    const isDeductible = payment.business?.isDgrRegistered === true;

    voluntaryTotal += amount;
    if (isDeductible) deductibleTotal += amount;
    else nonDeductibleTotal += amount;
  }

  return {
    voluntaryTotal,
    deductibleTotal,
    nonDeductibleTotal,
  };
};
