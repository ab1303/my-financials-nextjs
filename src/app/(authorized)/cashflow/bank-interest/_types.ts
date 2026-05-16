export type CleansingStatus = 'CLEANSED' | 'PARTIAL' | 'PENDING' | 'MANUAL' | 'NONE';

export type BankInterestType = {
  id: string;
  bankInterestLiabilityId: string;
  month: number;
  year: number;
  receivedFromLedger: number;
  manualOverride: number;
  receivedTotal: number;
  amountCleansed: number;
  balance: number;
  status: CleansingStatus;
  uncleansedTxCount: number;
};

export type YearlySummary = {
  totalReceived: number;
  totalCleansed: number;
  remaining: number;
};
