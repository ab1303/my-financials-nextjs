import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  voidSingleTransaction,
  undoImportSession,
} from '@/server/services/transactions/void.service';

async function deriveYearFlags(
  prisma: PrismaClient,
  userId: string,
  sessionCreatedAt: Date,
): Promise<{ yearWarning: boolean; isLocked: boolean }> {
  const monthNum = sessionCreatedAt.getMonth() + 1;
  const fiscal = await prisma.calendarYear.findFirst({
    where: {
      type: 'FISCAL',
      OR: [
        { fromYear: sessionCreatedAt.getFullYear(), fromMonth: { lte: monthNum } },
        { toYear: sessionCreatedAt.getFullYear(), toMonth: { gte: monthNum } },
      ],
    },
  });

  if (!fiscal) return { yearWarning: false, isLocked: false };

  const now = new Date();
  const yearEnded =
    fiscal.toYear < now.getFullYear() ||
    (fiscal.toYear === now.getFullYear() && fiscal.toMonth < now.getMonth() + 1);

  const isLocked = fiscal.lockedAt != null;
  void userId;

  return {
    isLocked,
    yearWarning: yearEnded && !isLocked,
  };
}

export const transactionClearingRouter = router({
  undoImportSession: protectedProcedure
    .input(z.object({ importSessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const session = await ctx.prisma.importSession.findUnique({
          where: { id: input.importSessionId },
          select: { id: true, userId: true, createdAt: true },
        });
        if (!session || session.userId !== userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Import session not found' });
        }

        const yearFlags = await deriveYearFlags(
          ctx.prisma as unknown as PrismaClient,
          userId,
          session.createdAt,
        );
        if (yearFlags.isLocked) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This fiscal year is locked. Undo is not allowed.',
          });
        }

        const result = await undoImportSession(
          { prisma: ctx.prisma, userId: ctx.session.user.id },
          input.importSessionId,
        );
        return { ...result, yearWarning: yearFlags.yearWarning };
      } catch (err) {
        if (err instanceof TRPCError) {
          throw err;
        }
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

  deletePendingSession: protectedProcedure
    .input(z.object({ importSessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.importSession.findUnique({
        where: { id: input.importSessionId },
        include: { _count: { select: { transactions: true } } },
      });
      if (!session || session.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      if (session.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only PENDING sessions can be deleted. Use Undo for completed imports.',
        });
      }
      if (session._count.transactions > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This session has transactions — use Undo instead.',
        });
      }
      await ctx.prisma.importSession.delete({ where: { id: input.importSessionId } });
      return { success: true };
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
      return Promise.all(
        sessions.map(async (s) => {
          const yearFlags = await deriveYearFlags(
            ctx.prisma as unknown as PrismaClient,
            userId,
            s.createdAt,
          );
          return {
            id: s.id,
            importType: s.importType,
            status: s.status,
            recordsCreated: s.recordsCreated,
            transactionCount: s._count.transactions,
            createdAt: s.createdAt.toISOString(),
            yearWarning: yearFlags.yearWarning,
            isLocked: yearFlags.isLocked,
          };
        }),
      );
    }),
});
