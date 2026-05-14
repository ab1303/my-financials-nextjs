import { IncomeSourceEnumType } from '@prisma/client';
import { NextRequest } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import {
  classifyCreditTransactions,
  classifyTransactions,
} from '@/server/services/ai-import/csv-classifier.service';
import type {
  ClassifiedCreditTransaction,
  ClassifiedTransactionV2,
  CsvTransaction,
} from '@/server/services/ai-import/_types';
import { ClassifyRequestSchema } from '@/server/services/ai-import/validation';

function groupTransactionsByMonth<T extends CsvTransaction>(transactions: T[]) {
  const monthMap = new Map<string, T[]>();

  for (const tx of transactions) {
    const month = `${tx.year}-${String(tx.month).padStart(2, '0')}`;
    const bucket = monthMap.get(month) ?? [];
    bucket.push(tx);
    monthMap.set(month, bucket);
  }

  return Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function sseEvent(encoder: TextEncoder, payload: Record<string, unknown>) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json();
    const parse = ClassifyRequestSchema.safeParse(body);

    if (!parse.success) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
    }

    const { fileId } = parse.data;

    const importSession = await prisma.importSession.findUnique({
      where: { id: fileId },
    });

    if (!importSession) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
    }

    if (importSession.userId !== session.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const transactions = ((importSession.metadata as Record<string, unknown> | null)?.transactions ?? []) as CsvTransaction[];

    if (!transactions.length) {
      return new Response(JSON.stringify({ error: 'No transactions in session' }), { status: 400 });
    }

    const debits = transactions.filter((tx) => tx.type === 'DEBIT');
    const credits = transactions.filter((tx) => tx.type === 'CREDIT');

    const debitMonths = groupTransactionsByMonth(debits);
    const creditMonths = groupTransactionsByMonth(credits);
    const totalMonths = debitMonths.length + creditMonths.length;

    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
    });

    if (!categories.length) {
      return new Response(JSON.stringify({ error: 'No expense categories configured' }), { status: 400 });
    }

    const encoder = new TextEncoder();
    let processed = 0;
    let totalLlmTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const [month, monthTransactions] of debitMonths) {
            try {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'progress',
                  month,
                  processed: ++processed,
                  total: totalMonths,
                }),
              );

              const result = await classifyTransactions(monthTransactions, categories);
              totalLlmTokens += result.usage.totalTokens;
              totalPromptTokens += result.usage.promptTokens;
              totalCompletionTokens += result.usage.completionTokens;

              controller.enqueue(
                sseEvent(encoder, {
                  type: 'debit_classified',
                  month,
                  transactions: result.classified.map((transaction) => ({
                    ...transaction,
                    type: 'DEBIT' as const,
                  })) as ClassifiedTransactionV2[],
                  usage: result.usage,
                }),
              );
            } catch (monthError: unknown) {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'warning',
                  month,
                  message: monthError instanceof Error ? monthError.message : `Error classifying month ${month}`,
                }),
              );
            }
          }

          for (const [month, monthTransactions] of creditMonths) {
            try {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'progress',
                  month,
                  processed: ++processed,
                  total: totalMonths,
                }),
              );

              const result = await classifyCreditTransactions(monthTransactions);
              totalLlmTokens += result.usage.totalTokens;
              totalPromptTokens += result.usage.promptTokens;
              totalCompletionTokens += result.usage.completionTokens;

              controller.enqueue(
                sseEvent(encoder, {
                  type: 'credit_classified',
                  month,
                  transactions: result.classified as ClassifiedCreditTransaction[],
                  usage: result.usage,
                }),
              );
            } catch (monthError: unknown) {
              controller.enqueue(
                sseEvent(encoder, {
                  type: 'warning',
                  month,
                  message: monthError instanceof Error ? monthError.message : `Error classifying month ${month}`,
                }),
              );
            }
          }

          if (totalLlmTokens > 0) {
            await prisma.aIUsageLog.create({
              data: {
                userId: session.user.id,
                sessionId: fileId,
                model: process.env.AI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
                importType: 'EXPENSE',
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
                totalTokens: totalLlmTokens,
                estimatedCostUSD:
                  (totalPromptTokens / 1_000_000) * 0.15 +
                  (totalCompletionTokens / 1_000_000) * 0.6,
                imageId: null,
              },
            });
          }

          controller.enqueue(
            sseEvent(encoder, {
              type: 'done',
              totalLlmTokens,
              model: process.env.AI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
              categories: categories.map((category) => ({ id: category.id, name: category.name })),
              incomeSourceLabels: [...Object.values(IncomeSourceEnumType), 'Transfer', 'Excluded'],
            }),
          );

          controller.close();
        } catch (error: unknown) {
          controller.enqueue(
            sseEvent(encoder, {
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    console.error('CSV classify error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

