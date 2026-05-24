import { z } from 'zod';

export const TransactionSummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  status: z.string(),
  importSessionId: z.string().optional(),
});

export const ImportSessionDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  importType: z.string(),
  status: z.string(),
  recordsCreated: z.number(),
  skippedCount: z.number(),
  metadata: z.any().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  transactions: z.array(TransactionSummarySchema),
});

export type TransactionSummary = z.infer<typeof TransactionSummarySchema>;
export type ImportSessionDetail = z.infer<typeof ImportSessionDetailSchema>;
