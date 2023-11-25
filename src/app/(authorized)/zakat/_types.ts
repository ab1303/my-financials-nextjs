import type { BeneficiaryEnumType } from '@prisma/client';

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
  beneficiaryId: string | null;
  beneficiaryType: BeneficiaryEnumType;
};
