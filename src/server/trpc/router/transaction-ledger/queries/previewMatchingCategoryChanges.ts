import { TransactionStatusEnum } from '@prisma/client';
import { z } from 'zod';
import { extractPattern } from '@/server/services/transactions/category-rule.service';
import { protectedProcedure } from '@/server/trpc/trpc';

const previewMatchingCategoryChangesSchema = z.object({
  transactionId: z.string().min(1),
  description: z.string().min(1),
  matchScope: z.object({ type: z.enum(['recent', 'all']), days: z.number().optional() }).optional(),
});

export const previewMatchingCategoryChangesQuery = protectedProcedure
  .input(previewMatchingCategoryChangesSchema)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    
    // Build date filter based on matchScope
    const dateFilter: any = {};
    if (input.matchScope?.type === 'recent') {
      const days = input.matchScope.days ?? 90;
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      dateFilter.gte = dateLimit.toISOString();
    }

    const pattern = extractPattern(input.description);
    if (!pattern) {
      return { matches: [], totalCount: 0 };
    }

    // Find ALL matching transactions (for count)
    const allMatches = await ctx.prisma.transaction.findMany({
      where: {
        userId,
        description: { contains: pattern, mode: 'insensitive' },
        id: { not: input.transactionId },
        status: { not: TransactionStatusEnum.VOIDED },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        type: true,
        category: true,
        status: true,
        bankAccountId: true,
      },
      orderBy: { date: 'desc' },
    });

    // Return sample (up to 5) and total count
    const matches = allMatches.slice(0, 5);
    const totalCount = allMatches.length;

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
    };
  });