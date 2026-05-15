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
