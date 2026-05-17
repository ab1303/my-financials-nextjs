import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc/trpc';

export const calendarYearRouter = router({
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
