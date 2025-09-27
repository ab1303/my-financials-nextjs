import type { BeneficiaryEnumType } from '@prisma/client';

import type { PaymentModel } from './payment';

export type ZakatModel = {
  id: string;
  calendarId: string;
  amountDue: number;
};

// TODO:
export type ZakatPaymentModel = PaymentModel & {
  beneficiaryType: BeneficiaryEnumType;
  zakatId: string | null;
};

// More flexible type for service layer operations
export type ZakatPaymentInput = {
  id?: string;
  datePaid: Date;
  amount: number;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryId?: string | null;
  businessId?: string | null;
  individualId?: string | null;
  zakatId?: string | null;
};
