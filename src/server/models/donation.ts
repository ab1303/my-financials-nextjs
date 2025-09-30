import type { BeneficiaryEnumType } from '@prisma/client';

import type { PaymentModel } from './payment';

export type DonationModel = {
  id: string;
  calendarId: string;
};

export type DonationPaymentModel = PaymentModel & {
  beneficiaryType: BeneficiaryEnumType;
  taxCategory: string;
  donationId: string | null;
};

// More flexible type for service layer operations
export type DonationPaymentInput = {
  id?: string;
  datePaid: Date;
  amount: number;
  beneficiaryType: BeneficiaryEnumType;
  taxCategory: string;
  beneficiaryId?: string | null;
  businessId?: string | null;
  individualId?: string | null;
  donationId?: string | null;
};
