import { type DonationPurposeEnum } from '@prisma/client';

import { prisma } from '../../utils/prisma';
import { type VoluntaryDonationInput, type VoluntaryDonationModel } from './types';

export const getVoluntaryDonations = async (
  calendarYearId: string,
  beneficiaryId?: string,
): Promise<Array<VoluntaryDonationModel>> => {
  const donations = await prisma.voluntaryDonation.findMany({
    where: {
      donationLedger: { calendarId: calendarYearId },
      ...(beneficiaryId ? { OR: [{ businessId: beneficiaryId }, { individualId: beneficiaryId }] } : {}),
    },
    include: { business: true, individual: true },
  });

  return donations.map((vd): VoluntaryDonationModel => ({
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
  }));
};

export const addVoluntaryDonation = async (
  input: VoluntaryDonationInput,
) => {
  return await prisma.voluntaryDonation.create({
    data: {
      id: input.id,
      donationLedgerId: input.donationLedgerId,
      datePaid: input.datePaid,
      amount: input.amount,
      beneficiaryType: input.beneficiaryType,
      businessId: input.beneficiaryType === 'BUSINESS' ? input.beneficiaryId : null,
      individualId: input.beneficiaryType === 'INDIVIDUAL' ? input.beneficiaryId : null,
      purpose: input.donationPurpose ?? 'VOLUNTARY',
      transactionId: input.transactionId,
    },
  });
};

export const updateVoluntaryDonation = async (
  id: string,
  input: VoluntaryDonationInput,
) => {
  return await prisma.voluntaryDonation.update({
    where: { id },
    data: {
      datePaid: input.datePaid,
      amount: input.amount,
      beneficiaryType: input.beneficiaryType,
      businessId: input.beneficiaryType === 'BUSINESS' ? input.beneficiaryId : null,
      individualId: input.beneficiaryType === 'INDIVIDUAL' ? input.beneficiaryId : null,
      updatedAt: new Date(),
    },
  });
};

export const deleteVoluntaryDonation = async (id: string) => {
  return await prisma.voluntaryDonation.delete({ where: { id } });
};

export const getLinkedTransactionIds = async (): Promise<string[]> => {
  const linked = await prisma.voluntaryDonation.findMany({
    where: { transactionId: { not: null } },
    select: { transactionId: true },
  });
  return linked.map((d) => d.transactionId!);
};
