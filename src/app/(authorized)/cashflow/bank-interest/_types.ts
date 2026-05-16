export type { MonthlyCredit, CleansingDonation, YearlySummary, YearlyCleansingData } from '@/server/services/bank-interest/interest-cleansing.service';

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
  status: 'CLEANSED' | 'PARTIAL' | 'PENDING' | 'MANUAL' | 'NONE';
  uncleansedTxCount: number;
};
