// CSV Import Wizard Types for Expense Tracking
import type { ClassifiedTransaction } from '@/server/services/ai-import/_types';

export interface UploadedCSVFile {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  rowCount: number;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'processing';
  error?: string;
  transactions?: CSVTransaction[];
}

export interface CSVTransaction {
  date: string; // ISO date string
  amount: number;
  description: string;
  month: number;
  year: number;
}

export interface CSVImportContext {
  importType: 'EXPENSE';
  calendarYearId: string;
}

export interface CSVImportResult {
  sessionId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  recordsCreated: number;
  monthsProcessed: number;
  totalMonths: number;
  errors: Array<{
    month: number;
    message: string;
  }>;
}

export interface ClassifiedMonth {
  month: string; // "YYYY-MM"
  transactions: ClassifiedTransaction[];
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  calendarYearId: string;
  onImportComplete?: () => void;
}

export interface CSVUploadStepProps {
  file: UploadedCSVFile | null;
  onFileSelected: (file: UploadedCSVFile) => void;
  onRemoveFile: () => void;
  onStartImport: () => void;
  isLoading?: boolean;
}

export interface CSVProcessingStepProps {
  file: UploadedCSVFile;
  onComplete: (result: CSVImportResult) => void;
  context: CSVImportContext;
}

export interface CSVResultsStepProps {
  result: CSVImportResult;
  file: UploadedCSVFile;
  onDone: () => void;
  onImportMore: () => void;
}

export type CSVWizardStep = 'upload' | 'processing' | 'results';
