import { TransactionStatusEnum } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure } from '@/server/trpc/trpc';

export const restoreVoidedTransactionMutation = protectedProcedure
  .input(z.object({ transactionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    const transaction = await ctx.prisma.transaction.findUnique({
      where: { id: input.transactionId },
      select: { userId: true, status: true, id: true },
    });

    if (!transaction || transaction.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (transaction.status !== TransactionStatusEnum.VOIDED) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only VOIDED transactions can be restored',
      });
    }

    await ctx.prisma.transaction.update({
      where: { id: input.transactionId },
      data: { status: TransactionStatusEnum.PENDING },
    });

    return { success: true };
  });
