import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getStorageAdapter } from '@/server/services/ai-import/image-storage.adapter';
import {
  extractExpenseData,
  extractBankAssetData,
} from '@/server/services/ai-import/ai-vision.service';
import {
  mapExpenseData,
  type ExpenseMapResult,
} from '@/server/services/ai-import/expense-mapper.service';
import {
  mapBankAssetData,
  type BankAssetMapResult,
} from '@/server/services/ai-import/bank-asset-mapper.service';
import { UploadRequestSchema } from '@/server/services/ai-import/validation';
import { ImportStatusEnum, ImportTypeEnum } from '@prisma/client';
import {
  calculateEstimatedCost,
  AI_MODEL_NAME,
  EMBEDDING_MODEL_NAME,
  calculateEmbeddingCost,
} from '@/constants/ai-pricing';

/**
 * POST /api/ai-import/parse
 *
 * Parse uploaded images using AI and create expense/bank asset entries.
 * Returns Server-Sent Events (SSE) stream with progress updates.
 *
 * Request body:
 * {
 *   imageIds: string[],
 *   importType: "EXPENSE" | "BANK_ASSET",
 *   context: {
 *     for EXPENSE: { calendarId: string, month: number }
 *     for BANK_ASSET: { snapshotDate: string }
 *   }
 * }
 *
 * Response: text/event-stream with progress events
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UploadRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { imageIds, importType, context } = validationResult.data;

    // Validate context based on import type
    if (importType === 'EXPENSE') {
      if (!context.calendarId || context.month === undefined) {
        return NextResponse.json(
          {
            error: 'Missing required context for EXPENSE import',
            required: ['calendarId', 'month'],
          },
          { status: 400 },
        );
      }
    }

    if (importType === 'BANK_ASSET') {
      if (!context.snapshotDate) {
        return NextResponse.json(
          {
            error: 'Missing required context for BANK_ASSET import',
            required: ['snapshotDate'],
          },
          { status: 400 },
        );
      }
    }

    // Create import session
    const importSession = await prisma.importSession.create({
      data: {
        userId,
        importType: importType as ImportTypeEnum,
        status: 'PROCESSING',
        metadata: { context },
      },
    });

    // Update all images to link to this session
    await prisma.importImage.updateMany({
      where: { id: { in: imageIds } },
      data: { sessionId: importSession.id },
    });

    // Return SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const storage = getStorageAdapter();
          let totalRecordsCreated = 0;
          let totalConfidence = 0;
          let successCount = 0;
          const imageResults: Array<{
            imageId: string;
            status: 'success' | 'failed' | 'partial';
            recordsCreated: number;
            confidence?: number;
            errors?: string[];
          }> = [];

          // Process each image
          for (let i = 0; i < imageIds.length; i++) {
            const imageId = imageIds[i]!;
            const imageIndex = i + 1;

            // Send progress event
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'progress',
                  message: `Processing image ${imageIndex} of ${imageIds.length}...`,
                  imageIndex,
                  totalImages: imageIds.length,
                })}\n\n`,
              ),
            );

            try {
              // Fetch image from database and storage
              const image = await prisma.importImage.findUnique({
                where: { id: imageId },
              });

              if (!image) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'error',
                      imageId,
                      message: `Image not found: ${imageId}`,
                    })}\n\n`,
                  ),
                );
                imageResults.push({
                  imageId,
                  status: 'failed',
                  recordsCreated: 0,
                  errors: ['Image not found'],
                });
                continue;
              }

              // Retrieve image from storage
              const imageBuffer = await storage.getImageBuffer(
                image.storageUrl,
              );

              // Extract data based on import type
              let mapResult: ExpenseMapResult | null = null;

              if (importType === 'EXPENSE') {
                // Extract expense data
                const extractionResult = await extractExpenseData(
                  imageBuffer,
                  [], // Will fetch available categories in mapExpenseData
                );

                // Non-blocking usage logging — runs after SSE response chunk is flushed
                after(async () => {
                  try {
                    const estimatedCostUSD = calculateEstimatedCost(
                      extractionResult.usage.promptTokens,
                      extractionResult.usage.completionTokens,
                    );
                    await prisma.aIUsageLog.create({
                      data: {
                        sessionId: importSession.id,
                        userId,
                        imageId,
                        importType: ImportTypeEnum.EXPENSE,
                        model: AI_MODEL_NAME,
                        promptTokens: extractionResult.usage.promptTokens,
                        completionTokens:
                          extractionResult.usage.completionTokens,
                        totalTokens: extractionResult.usage.totalTokens,
                        estimatedCostUSD,
                      },
                    });
                  } catch (logError) {
                    console.error(
                      '[ai-import/parse] Failed to log AI usage:',
                      logError,
                    );
                  }
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'extraction',
                      imageId,
                      message: `Extracted ${extractionResult.entries.length} items from image`,
                      entriesExtracted: extractionResult.entries.length,
                      confidence: extractionResult.confidence,
                    })}\n\n`,
                  ),
                );

                // Map to database records
                mapResult = await mapExpenseData(
                  extractionResult,
                  context.calendarId as string,
                  context.month as number,
                  userId,
                  imageId,
                );

                // Log embedding token usage (if any embedding calls were made)
                if (mapResult && mapResult.embeddingUsage.totalTokens > 0) {
                  after(async () => {
                    try {
                      const embeddingCost = calculateEmbeddingCost(
                        mapResult!.embeddingUsage.totalTokens,
                      );
                      await prisma.aIUsageLog.create({
                        data: {
                          sessionId: importSession.id,
                          userId,
                          imageId,
                          importType: ImportTypeEnum.EXPENSE,
                          model: EMBEDDING_MODEL_NAME,
                          promptTokens: mapResult!.embeddingUsage.promptTokens,
                          completionTokens: 0,
                          totalTokens: mapResult!.embeddingUsage.totalTokens,
                          estimatedCostUSD: embeddingCost,
                        },
                      });
                    } catch (logError) {
                      console.error(
                        '[ai-import/parse] Failed to log embedding usage:',
                        logError,
                      );
                    }
                  });
                }
              } else if (importType === 'BANK_ASSET') {
                const bankExtractionResult =
                  await extractBankAssetData(imageBuffer);

                // Non-blocking usage logging — runs after SSE response chunk is flushed
                after(async () => {
                  try {
                    const estimatedCostUSD = calculateEstimatedCost(
                      bankExtractionResult.usage.promptTokens,
                      bankExtractionResult.usage.completionTokens,
                    );
                    await prisma.aIUsageLog.create({
                      data: {
                        sessionId: importSession.id,
                        userId,
                        imageId,
                        importType: ImportTypeEnum.BANK_ASSET,
                        model: AI_MODEL_NAME,
                        promptTokens: bankExtractionResult.usage.promptTokens,
                        completionTokens:
                          bankExtractionResult.usage.completionTokens,
                        totalTokens: bankExtractionResult.usage.totalTokens,
                        estimatedCostUSD,
                      },
                    });
                  } catch (logError) {
                    console.error(
                      '[ai-import/parse] Failed to log AI usage:',
                      logError,
                    );
                  }
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'extraction',
                      imageId,
                      message: `Extracted ${bankExtractionResult.entries.length} accounts from image`,
                      entriesExtracted: bankExtractionResult.entries.length,
                      confidence: bankExtractionResult.confidence,
                    })}\n\n`,
                  ),
                );

                const bankMapResult: BankAssetMapResult =
                  await mapBankAssetData(
                    bankExtractionResult,
                    new Date(context.snapshotDate as string),
                    userId,
                    imageId,
                  );

                // Normalise shape to match ExpenseMapResult for shared downstream logic
                mapResult = {
                  success: bankMapResult.success,
                  entriesCreated: bankMapResult.entriesCreated,
                  confidence: bankMapResult.confidence,
                  warnings: bankMapResult.warnings,
                  errors: bankMapResult.errors,
                  embeddingUsage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                  },
                };
              }

              if (mapResult) {
                totalRecordsCreated += mapResult.entriesCreated;
                totalConfidence += mapResult.confidence;
                successCount++;

                const status = mapResult.success
                  ? 'success'
                  : mapResult.entriesCreated > 0
                    ? 'partial'
                    : 'failed';

                imageResults.push({
                  imageId,
                  status,
                  recordsCreated: mapResult.entriesCreated,
                  confidence: mapResult.confidence,
                  errors:
                    mapResult.errors.length > 0 ? mapResult.errors : undefined,
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'saved',
                      imageId,
                      message: `Created ${mapResult.entriesCreated} records`,
                      recordsCreated: mapResult.entriesCreated,
                      status,
                    })}\n\n`,
                  ),
                );
              }
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    imageId,
                    message: `Failed to process image: ${errorMsg}`,
                  })}\n\n`,
                ),
              );
              imageResults.push({
                imageId,
                status: 'failed',
                recordsCreated: 0,
                errors: [errorMsg],
              });
            }
          }

          // Calculate final stats
          const overallConfidence =
            successCount > 0 ? totalConfidence / successCount : 0;
          const finalStatus = imageResults.every((r) => r.status === 'success')
            ? ImportStatusEnum.COMPLETED
            : imageResults.some((r) => r.status === 'success')
              ? ImportStatusEnum.PARTIAL
              : ImportStatusEnum.FAILED;

          // Update import session with final results
          await prisma.importSession.update({
            where: { id: importSession.id },
            data: {
              status: finalStatus,
              overallConfidence,
              recordsCreated: totalRecordsCreated,
              metadata: { imageResults },
            },
          });

          // Send completion event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                sessionId: importSession.id,
                status: finalStatus,
                totalRecordsCreated,
                overallConfidence,
                successCount,
                totalImages: imageIds.length,
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error('[ai-import/parse] Stream error:', error);

          // Update session as failed
          await prisma.importSession.update({
            where: { id: importSession.id },
            data: {
              status: ImportStatusEnum.FAILED,
              metadata: { error: errorMsg },
            },
          });

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

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[ai-import/parse] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
