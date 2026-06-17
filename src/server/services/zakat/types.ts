import type { BeneficiaryEnumType } from '@prisma/client';

export type ZakatPaymentModel = {
  id: string;
  datePaid: Date;
  amount: number;
  businessId: string | null;
  individualId: string | null;
  zakatObligationId: string;
  transactionId: string | null;
  beneficiaryType: BeneficiaryEnumType;
  isDeductible: boolean;
  donationPurpose: 'ZAKAT';
};

export type ZakatPaymentInput = {
  id?: string;
  datePaid: Date;
  amount: number;
  beneficiaryType: BeneficiaryEnumType;
  beneficiaryId?: string | null;
  businessId?: string | null;
  individualId?: string | null;
  zakatObligationId: string;
  transactionId?: string | null;
};

export type ZakatModel = {
  id: string;
  amountDue: number;
  calendarId: string;
};

