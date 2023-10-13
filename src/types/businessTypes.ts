export type Address = {
  addressLine: string;
  street_address: string;
  suburb: string;
  postcode: string;
  state: string;
};

export type OptionType = {
  label: string;
  id: string;
};

export type BankType = {
  bankName: string;
  address: Address;
};

export type ProfileType = {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  contact: string;
};

export type YearType = {
  id: string;
  type: 'fiscal' | 'annual';
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
};

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
  paymentHistory?: Array<PaymentHistoryType>;
};
