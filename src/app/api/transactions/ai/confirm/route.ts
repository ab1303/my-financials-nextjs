import { NextRequest, NextResponse } from 'next/server';
import { ImportStatusEnum, ImportTypeEnum } from '@prisma/client';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { matchCategoryWithEmbedding } from '@/server/services/ai-import/category-matcher.service';
import {
  EMBEDDING_MODEL_NAME,
  calculateEmbeddingCost,
} from '@/constants/ai-pricing';

const AIConfirmRequestSchema = z.object({
  sessionId: z.string().cuid(),
  calendarYearId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  bankAccountId: z.string().cuid().optional(),
  images: z
    .array(
      z.object({
        imageId: z.string().cuid(),
        entries: z
          .array(
            z.object({
              categoryName: z.string().min(1),
              amount: z.number().positive(),
              confirmed: z.boolean(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const parse = AIConfirmRequestSchema.safeParse(body);

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parse.error.errors },
      { status: 400 },
    );
  }

  const { sessionId, calendarYearId, month, bankAccountId, images } = parse.data;

  const importSession = await prisma.importSession.findUnique({
    where: { id: sessionId },
  });

  if (!importSession || importSession.userId !== userId) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (bankAccountId) {
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 },
      );
    }
  }

  let ledger = await prisma.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendarYearId, userId } },
  });

  if (!ledger) {
    ledger = await prisma.expenseLedger.create({
      data: { calendarId: calendarYearId, userId },
    });
  }

  const activeCategories = await prisma.expenseCategory.findMany({
    where: { isActive: true },
  });

  const categoryByName = new Map(activeCategories.map((c) => [c.name, c.id]));

  let recordsCreated = 0;
  let status: 'COMPLETED' | 'PARTIAL' | 'FAILED' = 'COMPLETED';

  try {
    for (const image of images) {
      let imageEmbeddingUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      for (const entry of image.entries) {
        if (!entry.confirmed) continue;

        const match = await matchCategoryWithEmbedding(
          entry.categoryName,
          activeCategories,
        );
        const categoryId = match.categoryName
          ? categoryByName.get(match.categoryName) ?? null
          : null;

        imageEmbeddingUsage.promptTokens += match.embeddingUsage.promptTokens;
        imageEmbeddingUsage.completionTokens += match.embeddingUsage.completionTokens;
        imageEmbeddingUsage.totalTokens += match.embeddingUsage.totalTokens;

        if (!categoryId) continue;

        const existing = await prisma.monthlyExpenseSummary.findFirst({
          where: { expenseLedgerId: ledger.id, categoryId, month },
        });

        if (existing) {
          await prisma.monthlyExpenseSummary.update({
            where: { id: existing.id },
            data: { amount: { increment: entry.amount } },
          });
        } else {
          await prisma.monthlyExpenseSummary.create({
            data: {
              month,
              amount: entry.amount,
              categoryId,
              expenseLedgerId: ledger.id,
            },
          });
        }

        await prisma.transaction.create({
          data: {
            date: new Date(),
            description: entry.categoryName,
            amount: entry.amount,
            type: 'DEBIT',
            category: entry.categoryName,
            source: 'LLM_CLASSIFIED',
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            userId,
            bankAccountId: bankAccountId ?? null,
            importSessionId: sessionId,
          },
        });

        recordsCreated++;
      }

      if (imageEmbeddingUsage.totalTokens > 0) {
        await prisma.aIUsageLog.create({
          data: {
            sessionId: importSession.id,
            userId,
            imageId: image.imageId,
            importType: ImportTypeEnum.EXPENSE,
            model: EMBEDDING_MODEL_NAME,
            promptTokens: imageEmbeddingUsage.promptTokens,
            completionTokens: imageEmbeddingUsage.completionTokens,
            totalTokens: imageEmbeddingUsage.totalTokens,
            estimatedCostUSD: calculateEmbeddingCost(
              imageEmbeddingUsage.totalTokens,
            ),
          },
        });
      }
    }

    await prisma.importSession.update({
      where: { id: sessionId },
      data: { status: ImportStatusEnum.COMPLETED, recordsCreated },
    });
  } catch (err) {
    status = 'PARTIAL';
    await prisma.importSession.update({
      where: { id: sessionId },
      data: { status: ImportStatusEnum.PARTIAL },
    });
  }

  return NextResponse.json({ success: true, recordsCreated, sessionId, status });
}


