import { BeneficiaryEnumType } from '@prisma/client';

export type ServerActionType<T = unknown> = {
  success: boolean;
  error: unknown;
  data?: T;
};

export type DonationType = {
  id: string;
  calendarId: string;
  totalDonations: number;
  paymentHistory: Array<DonationPaymentType>;
};

export type DonationPaymentType = {
  id: string;
  datePaid: Date;
  amount: number;
  beneficiaryType: BeneficiaryEnumType;
  taxCategory: string;
  businessId?: string;
  individualId?: string;
  // Computed field for table operations
  beneficiaryId: string;
};

const BENEFICIARY_ENUM_KEYS = Object.entries(BeneficiaryEnumType).map(
  ([k]) => k as BeneficiaryEnumType,
);

export { BENEFICIARY_ENUM_KEYS };
