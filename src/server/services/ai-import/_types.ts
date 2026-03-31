import {
  ImportTypeEnum,
  ImportStatusEnum,
  StorageProviderEnum,
} from '@prisma/client';

/**
 * Types for AI Import feature
 */

export interface ImportImageData {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageUrl: string;
  storageProvider: StorageProviderEnum;
  confidence?: number | null;
  extractedData?: Record<string, unknown> | null;
  errorMessage?: string | null;
  status: 'success' | 'failed' | 'partial';
}

export interface ImportSessionResult {
  sessionId: string;
  importType: ImportTypeEnum;
  status: ImportStatusEnum;
  overallConfidence: number | null;
  recordsCreated: number;
  images: ImportImageData[];
  createdAt: Date;
}

export interface ExpenseImportContext {
  calendarId: string;
  month: number;
}

export interface BankAssetImportContext {
  snapshotDate: string; // ISO date string
  calendarId?: string; // Optional override for calendar type
}

export type ImportContext = ExpenseImportContext | BankAssetImportContext;

export interface AIExtractionResponse {
  success: boolean;
  confidence: number; // 0-1
  entries: Record<string, unknown>[];
  warnings: string[];
}

export interface ExpenseExtractionResult extends AIExtractionResponse {
  entries: Array<{
    categoryName: string;
    amount: number;
  }>;
}

export interface BankAssetExtractionResult extends AIExtractionResponse {
  bankName?: string;
  entries: Array<{
    accountName: string;
    balance: number;
    currency?: string;
  }>;
}

/**
 * Options for configuring AI import service
 */
export interface AIImportServiceOptions {
  storageProvider?: 'local' | 'vercel-blob' | 's3';
  maxFilesPerSession?: number;
  maxFileSize?: number;
  aiProvider?: 'openai' | 'google' | 'anthropic';
  aiModel?: string;
}

/**
 * DTO for upload API response
 */
export interface UploadResponse {
  imageIds: string[];
  images: Array<{
    imageId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
}

/**
 * DTO for parse/import API response
 */
export interface ParseResponse {
  sessionId: string;
  status: ImportStatusEnum;
  overallConfidence: number | null;
  recordsCreated: number;
  results: Array<{
    imageId: string;
    fileName: string;
    status: 'success' | 'failed' | 'partial';
    recordsCreated: number;
    confidence?: number;
    entries?: Record<string, unknown>[];
    errors?: string[];
  }>;
}
