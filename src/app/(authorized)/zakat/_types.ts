import { BeneficiaryEnumType } from '@prisma/client';

export type ServerActionType = {
  success: boolean;
  error: unknown;
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
};

const BENEFICIARY_ENUM_KEYS = Object.entries(BeneficiaryEnumType).map(
  ([k]) => k as BeneficiaryEnumType
);

export { BENEFICIARY_ENUM_KEYS };
