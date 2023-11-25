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
