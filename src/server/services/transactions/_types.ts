import type {
  ClassifiedCreditTransaction,
  ClassifiedTransactionV2,
} from '@/server/services/ai-import/_types';

export interface DebitMonth {
  month: string; // "YYYY-MM"
  transactions: ClassifiedTransactionV2[];
}

export interface CreditMonth {
  month: string; // "YYYY-MM"
  transactions: ClassifiedCreditTransaction[];
}

export interface MonthError {
  month: string;
  message: string;
}

export interface TransactionSaveResult {
  savedMonths: number;
  totalEntries: number;
  duplicatesSkipped: number;
  errors: MonthError[];
}

import type { TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';

export interface TransferCandidateScore {
  transactionId: string;
  bankAccountId: string;
  bankAccountName: string;
  bankName: string | null;
  date: string;           // ISO date string
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  status: TransactionStatusEnum;
  confidenceScore: number; // 0–100
  scoreBreakdown: {
    amountMatch: number;        // 0–40
    dateProximity: number;      // 0–30
    descriptionSimilarity: number; // 0–20
    sameBankBonus: number;      // 0–10
  };
  amountDiffWarning: string | null;
}

export interface TransferLinkResult {
  debitTransactionId: string;
  creditTransactionId: string;
  linkedAt: Date;
  rollupReversed: boolean;
  incomeRecordDeleted: boolean;
}

export interface TransferUnlinkResult {
  debitTransactionId: string;
  creditTransactionId: string;
  restoredDebitCategory: string;
  restoredDebitStatus: TransactionStatusEnum;
  rollupRestored: boolean;
}
