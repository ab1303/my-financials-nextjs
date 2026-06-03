import type {
  BeneficiaryEnumType,
  DonationPurposeEnum,
} from '@prisma/client';

import type { PaymentModel } from './payment';

export type DonationModel = {
  id: string;
  calendarId: string;
};

export type DonationPaymentModel = PaymentModel & {
  beneficiaryType: BeneficiaryEnumType;
  isDeductible: boolean;
  donationPurpose?: DonationPurposeEnum | null;
  donationLedgerId: string | null;
  transactionId?: string | null;
};

// More flexible type for service layer operations
export type DonationPaymentInput = {
  id?: string;
  datePaid: Date;
  amount: number;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryId?: string | null;
  businessId?: string | null;
  individualId?: string | null;
  donationPurpose?: DonationPurposeEnum | null;
  donationLedgerId?: string | null;
  transactionId?: string | null;
};
