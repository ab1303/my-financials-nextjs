import { z } from 'zod';

export const ExtractedEntrySchema = z.object({
  id: z.string(),
  categoryName: z.string(),
  amount: z.number(),
  confirmed: z.boolean(),
});

export const ExtractedImageResultSchema = z.object({
  imageId: z.string(),
  fileName: z.string(),
  confidence: z.number().min(0).max(1),
  entries: z.array(ExtractedEntrySchema),
  status: z.enum(['success', 'failed']),
  errorMessage: z.string().optional(),
});

export const SSEEventSchema = z.union([
  z.object({
    type: z.literal('progress'),
    imageIndex: z.number(),
    totalImages: z.number(),
    currentImage: z.string(),
  }),
  z.object({
    type: z.literal('extracted'),
    imageId: z.string(),
    confidence: z.number().min(0).max(1),
    entries: z.array(
      z.object({
        categoryName: z.string(),
        amount: z.number(),
      }),
    ),
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
    images: z.array(ExtractedImageResultSchema),
  }),
]);

export type SSEEvent = z.infer<typeof SSEEventSchema>;

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
