// AI Import Wizard Types for Expense and Bank Asset Tracking

export interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  status:
    | 'pending'
    | 'uploading'
    | 'uploaded'
    | 'analyzing'
    | 'saving'
    | 'success'
    | 'error';
  error?: string;
  confidence?: number;
  extractedData?: Record<string, unknown>;
}

export interface ExpenseImportContext {
  importType: 'EXPENSE';
  calendarYearId: string;
  month: number;
}

export interface BankAssetImportContext {
  importType: 'BANK_ASSET';
  snapshotDate: string; // ISO date string e.g. "2026-03-31"
}

export type ImportContext = ExpenseImportContext | BankAssetImportContext;

export interface ImportSessionResult {
  sessionId: string;
  recordsCreated: number;
  overallConfidence: number;
  images: ImageResult[];
}

export interface ImageResult {
  imageId: string;
  fileName: string;
  status: 'success' | 'partial' | 'failed';
  confidence?: number;
  entriesCreated?: number;
  errorMessage?: string;
  extractedData?: Record<string, unknown>;
}

export interface AIImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  calendarYearId: string;
  onImportComplete?: () => void;
}

export interface BankAssetAIImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSnapshotDate?: string;
  onImportComplete?: () => void;
}

export interface ProcessingStepProps {
  files: UploadedFile[];
  onComplete: (result: ImportSessionResult) => void;
  context: ImportContext;
}

export interface ResultsStepProps {
  result: ImportSessionResult;
  onDone: () => void;
  onImportMore: () => void;
}

export interface UploadStepProps {
  files: UploadedFile[];
  onFilesSelected: (files: UploadedFile[]) => void;
  onRemoveFile: (fileId: string) => void;
  onStartImport: () => void;
  context: ImportContext;
}

export type WizardStep = 'upload' | 'processing' | 'results';
