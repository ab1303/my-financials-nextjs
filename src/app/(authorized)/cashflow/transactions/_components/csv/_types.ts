import type {
  ClassifiedCreditMonth,
  ClassifiedCreditTransaction,
  ClassifiedTransactionV2,
} from '@/server/services/ai-import/_types';
import type { ClassifiedMonth } from '@/components/csv-import/TransactionReviewTable';

export interface UploadedCSVFile {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  rowCount: number;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'processing';
  error?: string;
  transactions?: Array<{
    date: string;
    amount: number;
    description: string;
    month: number;
    year: number;
  }>;
}

export interface CSVImportContext {
  importType: 'EXPENSE';
  bankAccountId: string;
}

export interface CSVImportResult {
  sessionId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  debitsSaved: number;
  creditsSaved: number;
  creditsExcluded: number;
  totalEntries: number;
  errors: Array<{ month: string; message: string }>;
}

export interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
}

export type CSVWizardStep = 'upload' | 'classifying' | 'review' | 'results';

export {
  ClassifiedTransactionV2,
  ClassifiedCreditTransaction,
  ClassifiedCreditMonth,
  ClassifiedMonth,
};
