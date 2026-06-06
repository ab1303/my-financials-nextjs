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
    .input(
      z.object({
        bankId: z.string(),
        dateFrom: z.string(),
        dateTo: z.string(),
      }),
    )
    .query(({ ctx, input }) =>
      getUnlinkedInterestTransactions(
        input.bankId,
        new Date(input.dateFrom),
        new Date(input.dateTo),
        ctx.session.user.id,
      ),
    ),
  getUnlinkedCleansingDebitTransactions: protectedProcedure
    .input(
      z.object({
        bankId: z.string(),
        categoryName: z.string().optional(),
        includeAnyType: z.boolean().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      getUnlinkedCleansingDebitTransactions(
        ctx.session.user.id,
        input.bankId,
        input.categoryName,
        { includeAnyType: input.includeAnyType },
      ),
    ),
  /**
   * Retrieves candidate DEBIT transactions for interest cleansing evidence linking.
   * Returns a ranked list of candidates with fuzzy match scoring (0-100%).
   * 
   * @param creditId - The ID of the interest CREDIT transaction to link evidence for.
   * @param bankAccountId - Optional filter to scope candidates to a specific account.
   * @param search - Fuzzy search string for description/amount.
   * @param dateFrom - ISO date string for candidate window start.
   * @param dateTo - ISO date string for candidate window end.
   * @param limit - Max results (default 20).
   * @param minScore - Minimum match percent threshold (0-100).
   * 
   * @returns Array of Candidate DTOs with matchPercent, accountName, and contribution breakdowns.
   */
  getCleansingDebitCandidates: protectedProcedure
    .input(
      z.object({
        creditId: z.string().optional(),
        bankAccountId: z.string().optional(),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        minScore: z.number().min(0).max(100).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      // Temporary debug: log incoming input and session user id to diagnose empty-call origin
      // Remove this logging once the root cause is identified.
      try {
        // eslint-disable-next-line no-console
        console.debug(
          '[bankInterest.getCleansingDebitCandidates] input=',
          input,
          'user=',
          ctx.session?.user?.id,
        );
      } catch (e) {
        // ignore logging errors
      }

      if (!ctx.session?.user?.id) {
        return [] as any;
      }

      if (!input.creditId) return [] as any;

      const params = {
        userId: ctx.session.user.id,
        creditId: input.creditId!,
        bankAccountId: input.bankAccountId,
        search: input.search,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
        minScore: input.minScore,
      };

      return getCleansingDebitCandidates(params);
    }),
  suggestAllocations: protectedProcedure
    .input(z.object({ creditId: z.string(), limit: z.number().optional() }))
    .query(({ ctx, input }) =>
      suggestAllocations(
        input.creditId,
        input.limit ?? 10,
        ctx.session.user.id,
      ),
    ),

  applyAllocations: protectedProcedure
    .input(
      z.object({
        creditId: z.string(),
        allocations: z.array(
          z.object({ evidenceId: z.string(), amount: z.number() }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      applyAllocations(input.creditId, input.allocations, ctx.session.user.id),
    ),

  removeAllocation: protectedProcedure
    .input(z.object({ allocationId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      removeAllocation(input.allocationId, ctx.session.user.id),
    ),
});
