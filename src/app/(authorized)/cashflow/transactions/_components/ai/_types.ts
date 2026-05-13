export interface ExtractedImageResult {
  imageId: string;
  fileName: string;
  confidence: number;
  entries: Array<{
    id: string;
    categoryName: string;
    amount: number;
    confirmed: boolean;
  }>;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface AIImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
}

export interface ReviewStepProps {
  sessionId: string;
  extractedImages: ExtractedImageResult[];
  categories: Array<{ id: string; name: string }>;
  calendarYearId: string;
  month: number;
  bankAccountId?: string;
  onConfirm: (result: AIImportSessionResult) => void;
  onBack: () => void;
  isConfirming: boolean;
}

export interface AIImportSessionResult {
  sessionId: string;
  recordsCreated: number;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
}

export type WizardStep = 'upload' | 'processing' | 'review' | 'results';
