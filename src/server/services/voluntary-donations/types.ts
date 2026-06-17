import type { BeneficiaryEnumType, DonationPurposeEnum } from '@prisma/client';

export type VoluntaryDonationModel = {
  id: string;
  datePaid: Date;
  amount: number;
  businessId: string | null;
  individualId: string | null;
  donationLedgerId: string;
  transactionId: string | null;
  beneficiaryType: BeneficiaryEnumType;
  isDeductible: boolean;
  donationPurpose: DonationPurposeEnum;
};

export type VoluntaryDonationInput = {
  id?: string;
  datePaid: Date;
  amount: number;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryId?: string | null;
  businessId?: string | null;
  individualId?: string | null;
  donationLedgerId: string;
  transactionId?: string | null;
  donationPurpose?: DonationPurposeEnum;
};
