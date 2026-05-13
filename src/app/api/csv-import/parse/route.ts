import { NextRequest } from 'next/server';
import { CsvParseRequestSchema } from '@/server/services/ai-import/validation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { mapExpenseData } from '@/server/services/ai-import/expense-mapper.service';
import type { ExpenseExtractionResult } from '@/server/services/ai-import/_types';
import type { CsvTransaction } from '@/server/services/ai-import/_types';

/**
 * POST /api/csv-import/parse
 * Streams CSV transaction processing via SSE
 * Groups transactions by month and processes each group
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json();
    const parse = CsvParseRequestSchema.safeParse(body);

    if (!parse.success) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
    }

    const { fileId, context } = parse.data;
    const { calendarId } = context;

    // Load import session
    const importSession = await prisma.importSession.findUnique({
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

    // Group by month
    const monthMap = new Map<string, CsvTransaction[]>();
    for (const tx of transactions) {
      const key = `${tx.year}-${tx.month}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, []);
      }
      monthMap.get(key)!.push(tx);
    }

    const months = Array.from(monthMap.keys()).sort();

    // Set up SSE stream
    const encoder = new TextEncoder();
    let monthsProcessed = 0;
    let totalRecordsCreated = 0;
    let failedMonths = 0;
    const totalMonths = months.length;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const monthKey of months) {
            const monthTransactions = monthMap.get(monthKey)!;
            // Extract month from key (format: "YYYY-M")
            const monthNum = parseInt(monthKey.split('-')[1]!);

            try {
              monthsProcessed++;

              // Emit progress
              controller.enqueue(
                encoder.encode(
                  `event: progress\ndata: ${JSON.stringify({
                    type: 'progress',
                    message: `Processing month ${monthNum}...`,
                    monthsProcessed,
                    totalMonths,
                  })}\n\n`
                )
              );

              // Build synthetic ExpenseExtractionResult
              const entries = monthTransactions.map(tx => ({
                categoryName: tx.description,
                amount: tx.amount,
              }));

              const result: ExpenseExtractionResult = {
                success: true,
                confidence: 1.0,
                entries,
                warnings: [],
                usage: {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                },
              };

              // Process this month's transactions
              const mapResult = await mapExpenseData(result, calendarId, monthNum, session.user.id);

              totalRecordsCreated += mapResult.entriesCreated;

              // Emit saved event
              const status = mapResult.success ? 'success' : mapResult.entriesCreated > 0 ? 'partial' : 'failed';
              controller.enqueue(
                encoder.encode(
                  `event: saved\ndata: ${JSON.stringify({
                    type: 'saved',
                    message: `Saved ${mapResult.entriesCreated} entries for month ${monthNum}`,
                    recordsCreated: mapResult.entriesCreated,
                    month: monthNum,
                    status,
                  })}\n\n`
                )
              );

              // Log AI usage
              if (mapResult.embeddingUsage.totalTokens > 0) {
                await prisma.aIUsageLog.create({
                  data: {
                    userId: session.user.id,
                    sessionId: importSession.id,
                    model: 'text-embedding-3-small',
                    importType: 'EXPENSE',
                    promptTokens: mapResult.embeddingUsage.promptTokens,
                    completionTokens: mapResult.embeddingUsage.completionTokens,
                    totalTokens: mapResult.embeddingUsage.totalTokens,
                    estimatedCostUSD: 0, // Calculated separately if needed
                    imageId: null,
                  },
                });
              }

              if (!mapResult.success && mapResult.entriesCreated === 0) {
                failedMonths++;
              }
            } catch (monthError: any) {
              failedMonths++;
              monthsProcessed++;

              // Emit error event for this month
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({
                    type: 'error',
                    message: monthError.message || `Error processing month ${monthNum}`,
                    month: monthNum,
                  })}\n\n`
                )
              );
            }
          }

          // Determine final status
          let finalStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED' = 'COMPLETED';
          if (failedMonths === totalMonths) {
            finalStatus = 'FAILED';
          } else if (failedMonths > 0) {
            finalStatus = 'PARTIAL';
          }

          // Update session status
          await prisma.importSession.update({
            where: { id: importSession.id },
            data: { status: finalStatus },
          });

          // Emit complete event
          controller.enqueue(
            encoder.encode(
              `event: complete\ndata: ${JSON.stringify({
                type: 'complete',
                sessionId: importSession.id,
                status: finalStatus,
                totalRecordsCreated,
                overallConfidence: 1.0,
                monthsProcessed,
              })}\n\n`
            )
          );

          controller.close();
        } catch (error: any) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                type: 'error',
                message: errorMsg,
              })}\n\n`
            )
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
    console.error('CSV parse error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
