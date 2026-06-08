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
    transactionId: dp.interestTxId ?? null,
    beneficiaryType: dp.beneficiaryType,
    isDeductible: dp.business?.isDgrRegistered === true,
    donationPurpose: dp.donationPurpose,
  }));
};

export const updateDonationPayment = async (
  model: DonationPaymentInput,
  donationPaymentId: string,
) => {
  await prisma.$transaction(async (tx) => {
    // Update legacy model
    const updatedLegacy = await tx.donationPayment.update({
      where: { id: donationPaymentId },
      data: {
        datePaid: model.datePaid,
        amount: model.amount,
        beneficiaryType: model.beneficiaryType,
        businessId:
          model.beneficiaryType === 'BUSINESS' ? model.beneficiaryId : null,
        individualId:
          model.beneficiaryType === 'INDIVIDUAL' ? model.beneficiaryId : null,
      },
      include: {
        business: true,
        individual: true,
      },
    });

    if (env.USE_NEW_DONATION_MODELS) {
      const purpose = updatedLegacy.donationPurpose;
      const updateData = {
        datePaid: updatedLegacy.datePaid,
        amount: updatedLegacy.amount,
        beneficiaryType: updatedLegacy.beneficiaryType,
        businessId: updatedLegacy.businessId,
        individualId: updatedLegacy.individualId,
      };

      if (purpose === 'VOLUNTARY') {
        await tx.voluntaryDonation.update({
          where: { id: donationPaymentId },
          data: updateData,
        });
      } else if (purpose === 'INTEREST_CLEANSING') {
        await tx.interestCleansing.update({
          where: { id: donationPaymentId },
          data: {
            datePaid: updatedLegacy.datePaid,
            amount: updatedLegacy.amount,
            sourceBusinessId: updatedLegacy.businessId,
          },
        });
      } else if (purpose === 'ZAKAT') {
        await tx.zakatPayment.update({
          where: { id: donationPaymentId },
          data: updateData,
        });
      }
    }
  });
};

export const addDonationPaymentDetail = async (
  donationLedgerId: string,
  payment: Omit<DonationPaymentInput, 'id' | 'donationLedgerId'>,
) => {
  console.log('DEBUG: USE_NEW_DONATION_MODELS is', env.USE_NEW_DONATION_MODELS);
  const createLegacyPayment = async (tx: Prisma.TransactionClient) => {
    return await tx.donationPayment.create({
      data: {
        donationLedgerId,
        datePaid: payment.datePaid,
        amount: payment.amount,
        beneficiaryType: payment.beneficiaryType,
        businessId:
          payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
        individualId:
          payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
        interestTxId: payment.transactionId ?? null,
        donationPurpose: payment.donationPurpose ?? 'VOLUNTARY',
      },
      include: {
        business: true,
        individual: true,
      },
    });
  };

  const created = await prisma.$transaction(async (tx) => {
    const legacyPayment = await createLegacyPayment(tx);

    if (env.USE_NEW_DONATION_MODELS) {
      try {
        const purpose = legacyPayment.donationPurpose;
        
        if (purpose === 'VOLUNTARY') {
          await tx.voluntaryDonation.create({
            data: {
              id: legacyPayment.id,
              donationLedgerId,
              datePaid: legacyPayment.datePaid,
              amount: legacyPayment.amount,
              beneficiaryType: legacyPayment.beneficiaryType,
              businessId: legacyPayment.businessId,
              individualId: legacyPayment.individualId,
              purpose: 'VOLUNTARY',
            },
          });
        } else if (purpose === 'INTEREST_CLEANSING') {
          await tx.interestCleansing.create({
            data: {
              id: legacyPayment.id,
              donationLedgerId,
              datePaid: legacyPayment.datePaid,
              amount: legacyPayment.amount,
              sourceBusinessId: legacyPayment.businessId,
              creditTxId: legacyPayment.interestTxId,
            },
          });
        } else if (purpose === 'ZAKAT') {
          await tx.zakatPayment.create({
            data: {
              id: legacyPayment.id,
              datePaid: legacyPayment.datePaid,
              amount: legacyPayment.amount,
              beneficiaryType: legacyPayment.beneficiaryType,
              businessId: legacyPayment.businessId,
              individualId: legacyPayment.individualId,
              zakatObligationId: donationLedgerId,
            },
          });
        }
      } catch (error) {
        console.error(`Failed to dual-write new donation model for ${legacyPayment.id}:`, error);
        // We throw here to rollback the entire transaction if the new domain model fails, ensuring data consistency
        throw error;
      }
    }

    return legacyPayment;
  });

  return {
    id: created.id,
    datePaid: created.datePaid,
    amount: created.amount.toNumber(),
    businessId: created.businessId,
    individualId: created.individualId,
    donationLedgerId: created.donationLedgerId,
    transactionId: created.interestTxId ?? null,
    beneficiaryType: created.beneficiaryType,
    isDeductible: created.business?.isDgrRegistered === true,
    donationPurpose: created.donationPurpose,
  } satisfies DonationPaymentModel;
};

export const deleteDonationPayment = async (donationPaymentId: string) => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.donationPayment.findUnique({
      where: { id: donationPaymentId },
      select: { interestTxId: true, donationPurpose: true },
    });

    if (!existing) return;

    // Handle legacy interest link cleanup
    if (existing.interestTxId) {
      await tx.donationPayment.update({
        where: { id: donationPaymentId },
        data: { interestTxId: null },
      });
    }

    // Delete legacy model
    await tx.donationPayment.delete({
      where: { id: donationPaymentId },
    });

    // Delete new domain model if enabled
    if (env.USE_NEW_DONATION_MODELS) {
      const purpose = existing.donationPurpose;
      if (purpose === 'VOLUNTARY') {
        await tx.voluntaryDonation.delete({ where: { id: donationPaymentId } });
      } else if (purpose === 'INTEREST_CLEANSING') {
        await tx.interestCleansing.delete({ where: { id: donationPaymentId } });
      } else if (purpose === 'ZAKAT') {
        await tx.zakatPayment.delete({ where: { id: donationPaymentId } });
      }
    }
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
