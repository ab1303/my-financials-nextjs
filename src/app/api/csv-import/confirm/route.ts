import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { mapExpenseData } from '@/server/services/ai-import/expense-mapper.service';
import { ConfirmImportRequestSchema } from '@/server/services/ai-import/validation';
import type { ExpenseExtractionResult } from '@/server/services/ai-import/_types';

/**
 * POST /api/csv-import/confirm
 * Confirms classified transactions and saves them to the database
 * Also creates/updates TransactionCategoryOverride records
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await req.json();
    const parse = ConfirmImportRequestSchema.safeParse(body);

    if (!parse.success) {
      console.error('Validation errors:', parse.error);
      return new NextResponse(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
    }

    const { fileId, calendarYearId, llmUsage, months } = parse.data;

    // Load import session
    const importSession = await prisma.importSession.findUnique({
      where: { id: fileId },
    });

    if (!importSession) {
      return new NextResponse(JSON.stringify({ error: 'Session not found' }), { status: 404 });
    }

    // Check ownership
    if (importSession.userId !== session.user.id) {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    // Fetch active expense categories
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

    let totalSavedMonths = 0;
    let totalEntries = 0;
    let failedMonths = 0;

    // Process each month
    for (const month of months) {
      try {
        // Extract month number from "YYYY-MM" format
        const monthNum = parseInt(month.month.split('-')[1]!, 10);

        // Build ExpenseExtractionResult using confirmed categories
        const entries = month.transactions.map((tx) => ({
          categoryName: tx.confirmedCategory,
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

        // Map and save expense data
        const mapResult = await mapExpenseData(
          result,
          calendarYearId,
          monthNum,
          session.user.id,
        );

        if (mapResult.success || mapResult.entriesCreated > 0) {
          totalSavedMonths++;
        } else {
          failedMonths++;
        }

        totalEntries += mapResult.entriesCreated;

        // Create/update MerchantCategoryMap records (best-effort — failures don't mark month as failed)
        try {
          for (const tx of month.transactions) {
            const descKey = tx.description.toLowerCase().trim();
            const categoryId = categoryMap.get(tx.confirmedCategory);

            if (categoryId) {
              await prisma.merchantCategoryMap.upsert({
                where: {
                  userId_description: {
                    userId: session.user.id,
                    description: descKey,
                  },
                },
                update: {
                  category: tx.confirmedCategory,
                  source: tx.overridden ? 'user_override' : 'llm_confirmed',
                  updatedAt: new Date(),
                },
                create: {
                  userId: session.user.id,
                  description: descKey,
                  category: tx.confirmedCategory,
                  source: tx.overridden ? 'user_override' : 'llm_confirmed',
                },
              });
            }
          }
        } catch (overrideError: any) {
          console.warn(`Could not save category overrides for ${month.month}:`, overrideError.message);
        }
      } catch (monthError: any) {
        failedMonths++;
        console.error(`Error processing month ${month.month}:`, monthError);
      }
    }

    // Log LLM usage if tokens were used
    if (llmUsage.totalTokens > 0) {
      // gpt-4o-mini: $0.15/1M input + $0.60/1M output tokens
      const estimatedCostUSD =
        (llmUsage.promptTokens / 1_000_000) * 0.15 +
        (llmUsage.completionTokens / 1_000_000) * 0.60;

      try {
        await prisma.aIUsageLog.create({
          data: {
            userId: session.user.id,
            sessionId: importSession.id,
            model: process.env.AI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
            importType: 'EXPENSE',
            promptTokens: llmUsage.promptTokens,
            completionTokens: llmUsage.completionTokens,
            totalTokens: llmUsage.totalTokens,
            estimatedCostUSD,
            imageId: null,
          },
        });
      } catch (usageLogError: any) {
        console.error('Failed to save AI usage log:', usageLogError.message);
      }
    }

    // Determine final status
    let finalStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED' = 'COMPLETED';
    if (failedMonths === months.length) {
      finalStatus = 'FAILED';
    } else if (failedMonths > 0) {
      finalStatus = 'PARTIAL';
    }

    // Update session status
    await prisma.importSession.update({
      where: { id: importSession.id },
      data: {
        status: finalStatus,
        recordsCreated: totalEntries,
      },
    });

    return NextResponse.json({
      success: true,
      savedMonths: totalSavedMonths,
      totalEntries,
      status: finalStatus,
    });
  } catch (error: any) {
    console.error('CSV confirm error:', error);
    return new NextResponse(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500 },
    );
  }
}
