import { DonationPurposeEnum, type Prisma } from '@prisma/client';

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
  beneficiaryId?: string,
): Promise<Array<DonationPaymentModel>> => {
  const [voluntary, zakat, interest] = await Promise.all([
    prisma.voluntaryDonation.findMany({
      where: {
        donationLedger: { calendarId: calendarYearId },
        ...(beneficiaryId ? { OR: [{ businessId: beneficiaryId }, { individualId: beneficiaryId }] } : {}),
      },
      include: { business: true, individual: true },
    }),
    prisma.zakatPayment.findMany({
      where: {
        zakatObligation: { calendarId: calendarYearId },
        ...(beneficiaryId ? { OR: [{ businessId: beneficiaryId }, { individualId: beneficiaryId }] } : {}),
      },
      include: { business: true, individual: true },
    }),
    prisma.interestCleansing.findMany({
      where: {
        donationLedger: { calendarId: calendarYearId },
        ...(beneficiaryId ? { sourceBusinessId: beneficiaryId } : {}),
      },
      include: { sourceBusiness: true },
    }),
  ]);

  return [
    ...voluntary.map((vd): DonationPaymentModel => ({
      id: vd.id,
      datePaid: vd.datePaid,
      amount: vd.amount.toNumber(),
      businessId: vd.businessId,
      individualId: vd.individualId,
      donationLedgerId: vd.donationLedgerId,
      transactionId: vd.transactionId,
      beneficiaryType: vd.beneficiaryType,
      isDeductible: vd.business?.isDgrRegistered === true,
      donationPurpose: vd.purpose as DonationPurposeEnum,
    })),
    ...zakat.map((zp): DonationPaymentModel => ({
      id: zp.id,
      datePaid: zp.datePaid,
      amount: zp.amount.toNumber(),
      businessId: zp.businessId,
      individualId: zp.individualId,
      donationLedgerId: zp.zakatObligationId,
      transactionId: zp.transactionId,
      beneficiaryType: zp.beneficiaryType,
      isDeductible: false,
      donationPurpose: 'ZAKAT',
    })),
    ...interest.map((ic): DonationPaymentModel => ({
      id: ic.id,
      datePaid: ic.datePaid,
      amount: ic.amount.toNumber(),
      businessId: ic.sourceBusinessId,
      individualId: null,
      donationLedgerId: ic.donationLedgerId,
      transactionId: ic.creditTxId,
      beneficiaryType: 'BUSINESS',
      isDeductible: ic.sourceBusiness?.isDgrRegistered === true,
      donationPurpose: 'INTEREST_CLEANSING',
    })),
  ];
};

export const updateDonationPayment = async (
  model: DonationPaymentInput,
  donationPaymentId: string,
) => {
  await prisma.$transaction(async (tx) => {
    // Attempt to find the record in one of the payment tables
    const voluntary = await tx.voluntaryDonation.findUnique({
      where: { id: donationPaymentId },
      select: { id: true },
    });
    const cleansing = await tx.interestCleansing.findUnique({
      where: { id: donationPaymentId },
      select: { id: true },
    });
    const zakat = await tx.zakatPayment.findUnique({
      where: { id: donationPaymentId },
      select: { id: true },
    });

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

    if (voluntary) {
      await tx.voluntaryDonation.update({
        where: { id: donationPaymentId },
        data: updateData,
      });
    } else if (cleansing) {
      await tx.interestCleansing.update({
        where: { id: donationPaymentId },
        data: {
          datePaid: updateData.datePaid,
          amount: updateData.amount,
          sourceBusinessId: updateData.businessId,
        },
      });
    } else if (zakat) {
      await tx.zakatPayment.update({
        where: { id: donationPaymentId },
        data: updateData,
      });
    } else {
      throw new Error('Donation payment not found');
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

/**
 * Gets donation totals broken down by beneficiary.
 */
export const getDonationTotalsByBeneficiary = async (
  calendarYearId: string,
): Promise<Array<{ id: string; name: string; total: number }>> => {
  const [voluntary, zakat] = await Promise.all([
    prisma.voluntaryDonation.findMany({
      where: { donationLedger: { calendarId: calendarYearId } },
      select: {
        amount: true,
        business: { select: { id: true, name: true } },
        individual: { select: { id: true, name: true } },
      },
    }),
    prisma.zakatPayment.findMany({
      where: { zakatObligation: { calendarId: calendarYearId } },
      select: {
        amount: true,
        business: { select: { id: true, name: true } },
        individual: { select: { id: true, name: true } },
      },
    }),
  ]);

  const beneficiaryTotals: Record<string, { id: string; name: string; total: number }> = {};

  [...voluntary, ...zakat].forEach((payment) => {
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
