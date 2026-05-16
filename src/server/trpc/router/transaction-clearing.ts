import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  voidSingleTransaction,
  undoImportSession,
} from '@/server/services/transactions/void.service';

export const transactionClearingRouter = router({
  undoImportSession: protectedProcedure
    .input(z.object({ importSessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await undoImportSession(
          { prisma: ctx.prisma, userId: ctx.session.user.id },
          input.importSessionId,
        );
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Undo failed',
        });
      }
    }),

  voidTransaction: protectedProcedure
    .input(z.object({ transactionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await voidSingleTransaction(
          { prisma: ctx.prisma, userId: ctx.session.user.id },
          input.transactionId,
        );
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Void failed',
        });
      }
    }),

  listImportSessions: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const sessions = await ctx.prisma.importSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          _count: { select: { transactions: true } },
        },
      });
      return sessions.map((s) => ({
        id: s.id,
        importType: s.importType,
        status: s.status,
        recordsCreated: s.recordsCreated,
        transactionCount: s._count.transactions,
        createdAt: s.createdAt.toISOString(),
      }));
    }),
});
