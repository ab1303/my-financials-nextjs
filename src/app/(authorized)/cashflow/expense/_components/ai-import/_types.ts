// AI Import Wizard Types for Expense Tracking

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
  calendarYearId: string;
  month: number;
}

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

export interface ProcessingStepProps {
  files: UploadedFile[];
  onComplete: (result: ImportSessionResult) => void;
  context: ExpenseImportContext;
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
  context: ExpenseImportContext;
}

export type WizardStep = 'upload' | 'processing' | 'results';
