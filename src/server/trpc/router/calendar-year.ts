import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc/trpc';

export const calendarYearRouter = router({
  getAll: protectedProcedure
    .input(
      z.object({
        types: z.array(z.enum(['FISCAL', 'ANNUAL'])).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const calendarYears = await ctx.prisma.calendarYear.findMany({
        where: {
          ...(input.types && input.types.length > 0 ? { type: { in: input.types } } : {}),
        },
        orderBy: [{ fromYear: 'desc' }],
        select: {
          id: true,
          description: true,
          fromYear: true,
          fromMonth: true,
          toYear: true,
          toMonth: true,
          type: true,
        },
      });
      return calendarYears;
    }),

  lockYear: protectedProcedure
    .input(z.object({ calendarYearId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const year = await ctx.prisma.calendarYear.findUnique({
        where: { id: input.calendarYearId },
      });

      if (!year) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Calendar year not found' });
      }

      return ctx.prisma.calendarYear.update({
        where: { id: input.calendarYearId },
        data: { lockedAt: new Date() },
      });
    }),

  unlockYear: protectedProcedure
    .input(z.object({ calendarYearId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const year = await ctx.prisma.calendarYear.findUnique({
        where: { id: input.calendarYearId },
      });

      if (!year) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Calendar year not found' });
      }

      return ctx.prisma.calendarYear.update({
        where: { id: input.calendarYearId },
        data: { lockedAt: null },
      });
    }),
});
