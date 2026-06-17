export type InterestCleansingModel = {
  id: string;
  datePaid: Date;
  amount: number;
  sourceBusinessId: string | null;
  donationLedgerId: string;
  transactionId: string | null;
  isDeductible: boolean;
  donationPurpose: 'INTEREST_CLEANSING';
};

export type InterestCleansingInput = {
  id?: string;
  datePaid: Date;
  amount: number;
  sourceBusinessId: string | null;
  donationLedgerId: string;
  transactionId?: string | null;
};
