import { NextRequest } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { classifyTransactions } from '@/server/services/ai-import/csv-classifier.service';
import { ClassifyRequestSchema } from '@/server/services/ai-import/validation';
import type { CsvTransaction, ClassifiedTransaction } from '@/server/services/ai-import/_types';

/**
 * POST /api/csv-import/classify
 * Streams CSV transaction classification via SSE
 * Groups transactions by month and classifies each group
 */
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

    const { fileId, calendarId } = parse.data;

    // Load import session
    const importSession = await prisma.aIImportSession.findUnique({
      where: { id: fileId },
    });

    if (!importSession) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
    }

    // Check ownership
    if (importSession.userId !== session.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const transactions = ((importSession.metadata as Record<string, any>)?.transactions || []) as CsvTransaction[];

    if (!transactions.length) {
      return new Response(JSON.stringify({ error: 'No transactions in session' }), { status: 400 });
    }

    // Fetch active expense categories
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
    });

    if (!categories.length) {
      return new Response(JSON.stringify({ error: 'No expense categories configured' }), { status: 400 });
    }

    // Group by month key
    const monthMap = new Map<string, CsvTransaction[]>();
    for (const tx of transactions) {
      const key = `${tx.year}-${String(tx.month).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, []);
      }
      monthMap.get(key)!.push(tx);
    }

    const months = Array.from(monthMap.keys()).sort();

    // Set up SSE stream
    const encoder = new TextEncoder();
    let monthsProcessed = 0;
    const totalMonths = months.length;
    let totalLlmTokens = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const monthKey of months) {
            const monthTransactions = monthMap.get(monthKey)!;

            try {
              monthsProcessed++;

              // Emit progress
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    message: `Classifying ${monthKey}...`,
                    month: monthKey,
                    processed: monthsProcessed,
                    total: totalMonths,
                  })}\n\n`,
                ),
              );

              // Classify transactions for this month
              const result = await classifyTransactions(monthTransactions, categories);

              totalLlmTokens += result.usage.totalTokens;

              // Emit classified event
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'classified',
                    month: monthKey,
                    transactions: result.classified,
                    usage: result.usage,
                  })}\n\n`,
                ),
              );
            } catch (monthError: any) {
              monthsProcessed++;

              // Emit warning event for this month
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'warning',
                    month: monthKey,
                    message: monthError.message || `Error classifying month ${monthKey}`,
                  })}\n\n`,
                ),
              );
            }
          }

          // Emit done event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                totalLlmTokens,
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (error: any) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: errorMsg,
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('CSV classify error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
