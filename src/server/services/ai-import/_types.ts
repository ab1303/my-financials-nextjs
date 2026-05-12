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

export interface AITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

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
  usage: AITokenUsage;
}

export interface BankAssetExtractionResult extends AIExtractionResponse {
  bankName?: string;
  entries: Array<{
    accountName: string;
    balance: number;
    currency?: string;
  }>;
  usage: AITokenUsage;
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

/**
 * Result of an embedding-based category match attempt.
 */
export interface EmbeddingMatchResult {
  /** Whether a match was found above the similarity threshold */
  matched: boolean;
  /** The matched category name, or null if no match */
  categoryName: string | null;
  /** Cosine similarity score (0–1) of the best match */
  similarity: number;
  /** Which matching method produced this result */
  method: 'exact' | 'substring' | 'embedding' | 'fuzzy';
}

/**
 * CSV Transaction from CommBank CSV format
 */
export interface CsvTransaction {
  date: string; // 'DD/MM/YYYY'
  amount: number; // positive absolute value
  description: string;
  month: number; // 1-12
  year: number;
  balance?: number;
}

/**
 * Result of CSV parsing operation
 */
export interface CsvParseResult {
  success: boolean;
  transactions?: CsvTransaction[];
  error?: string;
  message?: string;
}

/**
 * Response from CSV upload endpoint
 */
export interface CsvUploadResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  transactions: CsvTransaction[];
}

/**
 * Request body for CSV parse endpoint
 */
export interface CsvParseRequest {
  fileId: string;
  importType: 'EXPENSE';
  context: {
    calendarId: string;
  };
}
