import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getStorageAdapter } from '@/server/services/ai-import/image-storage.adapter';
import { extractExpenseData } from '@/server/services/ai-import/ai-vision.service';
import { UploadRequestSchema } from '@/server/services/ai-import/validation';
import {
  AI_MODEL_NAME,
  calculateEstimatedCost,
} from '@/constants/ai-pricing';
import { ImportStatusEnum, ImportTypeEnum } from '@prisma/client';

const TransactionAIParseRequestSchema = UploadRequestSchema.extend({
  bankAccountId: z.string().cuid().optional(),
});

type ExtractedImageResult = {
  imageId: string;
  fileName: string;
  confidence: number;
  entries: Array<{ categoryName: string; amount: number }>;
  status: 'success' | 'failed';
  errorMessage?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const validationResult = TransactionAIParseRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { imageIds, importType, context, bankAccountId } = validationResult.data;

    if (importType !== 'EXPENSE') {
      return NextResponse.json(
        {
          error: 'Unsupported import type',
          required: ['EXPENSE'],
        },
        { status: 400 },
      );
    }

    if (!context.calendarId || context.month === undefined) {
      return NextResponse.json(
        {
          error: 'Missing required context for EXPENSE import',
          required: ['calendarId', 'month'],
        },
        { status: 400 },
      );
    }

    if (bankAccountId) {
      const account = await prisma.financialAccount.findFirst({
        where: { id: bankAccountId, userId },
      });

      if (!account) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 },
        );
      }
    }

    const importSession = await prisma.importSession.create({
      data: {
        userId,
        importType: ImportTypeEnum.EXPENSE,
        status: ImportStatusEnum.PROCESSING,
        metadata: { context, bankAccountId: bankAccountId ?? null },
      },
    });

    await prisma.importImage.updateMany({
      where: { id: { in: imageIds } },
      data: { sessionId: importSession.id },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const storage = getStorageAdapter();
          const imageResults: ExtractedImageResult[] = [];
          const totalImages = imageIds.length;

          for (let i = 0; i < imageIds.length; i++) {
            const imageId = imageIds[i]!;
            const imageIndex = i + 1;

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'progress',
                  message: `Processing image ${imageIndex} of ${totalImages}...`,
                  imageIndex,
                  totalImages,
                })}\n\n`,
              ),
            );

            try {
              const image = await prisma.importImage.findUnique({
                where: { id: imageId },
              });

              if (!image) {
                imageResults.push({
                  imageId,
                  fileName: '',
                  confidence: 0,
                  entries: [],
                  status: 'failed',
                  errorMessage: 'Image not found',
                });

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'error',
                      imageId,
                      message: `Image not found: ${imageId}`,
                    })}\n\n`,
                  ),
                );
                continue;
              }

              const imageBuffer = await storage.getImageBuffer(image.storageUrl);
              const extractionResult = await extractExpenseData(imageBuffer, []);

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
                      completionTokens: extractionResult.usage.completionTokens,
                      totalTokens: extractionResult.usage.totalTokens,
                      estimatedCostUSD,
                    },
                  });
                } catch (logError) {
                  console.error(
                    '[transactions/ai/parse] Failed to log AI usage:',
                    logError,
                  );
                }
              });

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'extracted',
                    imageId,
                    confidence: extractionResult.confidence,
                    entries: extractionResult.entries,
                  })}\n\n`,
                ),
              );

              imageResults.push({
                imageId,
                fileName: image.fileName,
                confidence: extractionResult.confidence,
                entries: extractionResult.entries,
                status: 'success',
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);

              imageResults.push({
                imageId,
                fileName: '',
                confidence: 0,
                entries: [],
                status: 'failed',
                errorMessage,
              });

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    imageId,
                    message: `Failed to process image: ${errorMessage}`,
                  })}\n\n`,
                ),
              );
            }
          }

          await prisma.importSession.update({
            where: { id: importSession.id },
            data: {
              status: ImportStatusEnum.PROCESSING,
              metadata: { context, bankAccountId: bankAccountId ?? null, imageResults },
            },
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                sessionId: importSession.id,
                images: imageResults,
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          await prisma.importSession.update({
            where: { id: importSession.id },
            data: {
              status: ImportStatusEnum.FAILED,
              metadata: { error: errorMessage },
            },
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: errorMessage,
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
    console.error('[transactions/ai/parse] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
