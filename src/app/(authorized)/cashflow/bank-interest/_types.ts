export type PaymentHistoryType = {
  id: string;
  datePaid: Date;
  amount: number;
  businessId: string | null;
};

export type BankInterestType = {
  id: string;
  month: number;
  year: number;
  amountDue: number;
  amountPaid: number;
  paymentHistory: Array<PaymentHistoryType>;
};
