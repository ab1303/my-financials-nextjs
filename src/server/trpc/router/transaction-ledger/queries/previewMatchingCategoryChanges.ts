import type { Prisma } from '@prisma/client';
import { TransactionStatusEnum } from '@prisma/client';
import { z } from 'zod';

import { extractPattern } from '@/server/services/transactions/category-rule.service';
import { protectedProcedure } from '@/server/trpc/trpc';

const previewMatchingCategoryChangesSchema = z.object({
  transactionId: z.string().min(1),
  description: z.string().min(1),
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  matchScope: z
    .object({ type: z.enum(['recent', 'all']), days: z.number().optional() })
    .optional(),
});

export const previewMatchingCategoryChangesQuery = protectedProcedure
  .input(previewMatchingCategoryChangesSchema)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const pattern = extractPattern(input.description);

    if (!pattern) {
      return { matches: [], totalCount: 0, nextCursor: null };
    }

    const where: Prisma.TransactionWhereInput = {
      userId,
      description: { contains: pattern, mode: 'insensitive' },
      id: { not: input.transactionId },
      status: { not: TransactionStatusEnum.VOIDED },
    };

    if (input.matchScope?.type === 'recent') {
      const days = input.matchScope.days ?? 90;
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      where.date = { gte: dateLimit };
    }

    const [totalCount, rows] = await Promise.all([
      ctx.prisma.transaction.count({ where }),
      ctx.prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        select: {
          id: true,
          date: true,
          description: true,
          amount: true,
          type: true,
          category: true,
          status: true,
        },
      }),
    ]);

    const hasNextPage = rows.length > input.limit;
    const matches = hasNextPage ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasNextPage
      ? (matches[matches.length - 1]?.id ?? null)
      : null;

    return {
      matches: matches.map((m) => ({
        id: m.id,
        date: m.date.toISOString().slice(0, 10),
        description: m.description,
        amount: typeof m.amount === 'number' ? m.amount : m.amount.toNumber(),
        type: m.type,
        category: m.category,
        status: m.status,
      })),
      totalCount,
      nextCursor,
    };
  });
