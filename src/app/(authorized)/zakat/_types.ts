import { BeneficiaryEnumType } from '@prisma/client';

export type ServerActionType<T = unknown> = {
  success: boolean;
  error: unknown;
  data?: T;
};

export type ZakatType = {
  id: string;
  calendarId: string;
  amountDue: number;
  paymentHistory: Array<ZakatPaymentType>;
};

export type ZakatPaymentType = {
  id: string;
  datePaid: Date;
  amount: number;
  beneficiaryId: string;
  beneficiaryType: BeneficiaryEnumType;
  // Tax category is derived from beneficiary DGR status (DEDUCTIBLE or NON_DEDUCTIBLE)
  taxCategory: string;
};

const BENEFICIARY_ENUM_KEYS = Object.entries(BeneficiaryEnumType).map(
  ([k]) => k as BeneficiaryEnumType,
);

export { BENEFICIARY_ENUM_KEYS };
