import { z } from 'zod';

// Expense Import Request Schema
export const ExpenseImportRequestSchema = z.object({
  imageIds: z.array(z.string().cuid()),
  importType: z.literal('EXPENSE'),
  context: z.object({
    calendarYearId: z.string().cuid(),
    month: z.number().min(1).max(12),
  }),
});

export type ExpenseImportRequest = z.infer<typeof ExpenseImportRequestSchema>;

// Bank Asset Import Request Schema
export const BankAssetImportRequestSchema = z.object({
  imageIds: z.array(z.string().cuid()),
  importType: z.literal('BANK_ASSET'),
  context: z.object({
    snapshotDate: z.string().datetime(),
  }),
});

export type BankAssetImportRequest = z.infer<
  typeof BankAssetImportRequestSchema
>;

// File Upload Schema
export const FileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/heic']),
  size: z.number().max(10 * 1024 * 1024, 'File size must not exceed 10MB'),
  buffer: z.instanceof(Buffer),
});

// Extract Result from SSE Event
export const SSEEventSchema = z.union([
  z.object({
    type: z.literal('progress'),
    imageIndex: z.number(),
    totalImages: z.number(),
    currentImage: z.string(),
  }),
  z.object({
    type: z.literal('extraction'),
    imageId: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal('saved'),
    imageId: z.string(),
    entriesCreated: z.number(),
  }),
  z.object({
    type: z.literal('error'),
    imageId: z.string(),
    errorMessage: z.string(),
  }),
  z.object({
    type: z.literal('complete'),
    sessionId: z.string(),
    recordsCreated: z.number(),
    overallConfidence: z.number().min(0).max(1),
    images: z.array(
      z.object({
        imageId: z.string(),
        fileName: z.string(),
        status: z.enum(['success', 'partial', 'failed']),
        confidence: z.number().optional(),
        entriesCreated: z.number().optional(),
        errorMessage: z.string().optional(),
      }),
    ),
  }),
]);

export type SSEEvent = z.infer<typeof SSEEventSchema>;

// Confidence Level
export const ConfidenceLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.6) return 'MEDIUM';
  return 'LOW';
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'HIGH':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'LOW':
      return 'bg-red-100 text-red-800 border-red-300';
  }
}
