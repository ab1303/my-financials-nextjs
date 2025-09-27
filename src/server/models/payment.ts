export type PaymentModel = {
  id: string;
  datePaid: Date;
  amount: number;
  businessId: string | null;
  individualId?: string | null;
  beneficiaryId?: string | null; // Generic beneficiary ID that maps to either businessId or individualId
};
