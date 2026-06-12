import { TransactionTypeEnum, TransactionStatusEnum } from '@prisma/client';
import { z } from 'zod';
import { protectedProcedure } from '@/server/trpc/trpc';
import { REIMBURSEMENT_CATEGORY } from '@/server/services/transactions/constants';

export const searchDebitTransactionsQuery = protectedProcedure
  .input(
    z.object({
      search: z.string().optional(),
      // Allow larger fetches for bulk linking workflows — server hard cap increased.
      limit: z.number().int().min(1).max(200).default(100),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionTypeEnum.DEBIT,
        OR: [
          { status: TransactionStatusEnum.CONFIRMED },
          {
            status: TransactionStatusEnum.EXCLUDED,
            category: REIMBURSEMENT_CATEGORY,
          },
        ],
        reimbursements: { none: {} },
        ...(input.search?.trim()
          ? {
              OR: [
                {
                  description: {
                    contains: input.search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  category: {
                    contains: input.search.trim(),
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
        ...(input.dateFrom || input.dateTo
          ? {
              date: {
                ...(input.dateFrom
                  ? { gte: new Date(`${input.dateFrom}T00:00:00`) }
                  : {}),
                ...(input.dateTo
                  ? { lte: new Date(`${input.dateTo}T23:59:59`) }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }],
      take: input.limit,
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        category: true,
        importSession: { select: { id: true, createdAt: true } },
      },
    });
    return transactions.map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString().slice(0, 10),
      description: tx.description,
      amount: Number(tx.amount),
      category: tx.category,
      importSource: tx.importSession
        ? {
            id: tx.importSession.id,
            createdAt: tx.importSession.createdAt.toISOString(),
          }
        : undefined,
    }));
  });
