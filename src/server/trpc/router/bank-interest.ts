import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  getYearlyCleansingData,
  getUnlinkedInterestTransactions,
  getUnlinkedCleansingDebitTransactions,
  getCleansingDebitCandidates,
  suggestAllocations,
  applyAllocations,
  removeAllocation,
} from '@/server/services/bank-interest/interest-cleansing.service';

export const bankInterestRouter = router({
  getInterestCleansingData: protectedProcedure
    .input(z.object({ bankId: z.string(), calendarYearId: z.string() }))
    .query(({ ctx, input }) =>
      getYearlyCleansingData(
        input.bankId,
        input.calendarYearId,
        ctx.session.user.id,
      ),
    ),
  getUnlinkedInterestTransactions: protectedProcedure
    .input(z.object({ bankId: z.string(), dateFrom: z.string(), dateTo: z.string() }))
    .query(({ ctx, input }) =>
      getUnlinkedInterestTransactions(
        input.bankId,
        new Date(input.dateFrom),
        new Date(input.dateTo),
        ctx.session.user.id,
      ),
    ),
  getUnlinkedCleansingDebitTransactions: protectedProcedure
    .input(z.object({ bankId: z.string() }))
    .query(({ ctx, input }) =>
      getUnlinkedCleansingDebitTransactions(
        ctx.session.user.id,
        input.bankId,
      ),
    ),
  getCleansingDebitCandidates: protectedProcedure
    .input(z.object({
      creditId: z.string(),
      bankAccountId: z.string().optional(),
      search: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
      minScore: z.number().min(0).max(100).optional(),
    }))
    .query(({ ctx, input }) =>
      getCleansingDebitCandidates({ userId: ctx.session.user.id, ...input }),
    ),
  suggestAllocations: protectedProcedure
    .input(z.object({ creditId: z.string(), limit: z.number().optional() }))
    .query(({ ctx, input }) =>
      suggestAllocations(input.creditId, input.limit ?? 10, ctx.session.user.id),
    ),

  applyAllocations: protectedProcedure
    .input(z.object({
      creditId: z.string(),
      allocations: z.array(z.object({ evidenceId: z.string(), amount: z.number() })),
    }))
    .mutation(async ({ ctx, input }) =>
      applyAllocations(input.creditId, input.allocations, ctx.session.user.id),
    ),

  removeAllocation: protectedProcedure
    .input(z.object({ allocationId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      removeAllocation(input.allocationId, ctx.session.user.id),
    ),
});
