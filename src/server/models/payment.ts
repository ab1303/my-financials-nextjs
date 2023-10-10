export type PaymentModel = {
  id: string;
  datePaid: Date;
  amount: number;
  businessId: string | null;
};
