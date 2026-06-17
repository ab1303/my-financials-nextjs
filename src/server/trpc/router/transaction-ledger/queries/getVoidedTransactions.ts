import { Prisma, TransactionStatusEnum } from '@prisma/client';
import { z } from 'zod';
import { protectedProcedure } from '@/server/trpc/trpc';
import { TRPCError } from '@trpc/server';

export const getVoidedTransactionsQuery = protectedProcedure
  .input(
    z.object({
      importSessionId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      page: z.number().int().min(1).default(1),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const where: Prisma.TransactionWhereInput = {
      userId,
      status: TransactionStatusEnum.VOIDED,
      ...(input.importSessionId && {
        importSessionId: input.importSessionId,
      }),
    };

    const [transactions, total] = await Promise.all([
      ctx.prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: {
          id: true,
          date: true,
          description: true,
          amount: true,
          type: true,
          category: true,
          status: true,
          importSessionId: true,
          createdAt: true,
        },
      }),
      ctx.prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date.toISOString(),
        description: tx.description,
        amount: Number(tx.amount),
        type: tx.type,
        category: tx.category,
        status: tx.status,
        importSessionId: tx.importSessionId,
        createdAt: tx.createdAt.toISOString(),
      })),
      total,
      page: input.page,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    };
  });
