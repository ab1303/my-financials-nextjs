import { z } from 'zod';

import {
  applyAllocations,
  getCleansingDebitCandidates,
  getUnlinkedCleansingDebitTransactions,
  getUnlinkedInterestTransactions,
  getYearlyCleansingData,
  removeAllocation,
  suggestAllocations,
} from '@/server/services/bank-interest/interest-cleansing.service';
import { deleteInterestCleansingPayment } from '@/server/services/interest-cleansing/interest-cleansing.service';
import { protectedProcedure, router } from '@/server/trpc/trpc';

export const bankInterestRouter = router({
  getInterestCleansingData: protectedProcedure
    .input(z.object({ institutionId: z.string(), calendarYearId: z.string() }))
    .query(({ ctx, input }) =>
      getYearlyCleansingData(
        input.institutionId,
        input.calendarYearId,
        ctx.session.user.id,
      ),
    ),
  getUnlinkedInterestTransactions: protectedProcedure
    .input(
      z.object({
        institutionId: z.string(),
        dateFrom: z.string(),
        dateTo: z.string(),
      }),
    )
    .query(({ ctx, input }) =>
      getUnlinkedInterestTransactions(
        input.institutionId,
        new Date(input.dateFrom),
        new Date(input.dateTo),
        ctx.session.user.id,
      ),
    ),
  getUnlinkedCleansingDebitTransactions: protectedProcedure
    .input(
      z.object({
        institutionId: z.string(),
        categoryName: z.string().optional(),
        includeAnyType: z.boolean().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      getUnlinkedCleansingDebitTransactions(
        ctx.session.user.id,
        input.institutionId,
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
      if (!ctx.session?.user?.id) {
        return [];
      }

      if (!input.creditId) return [];

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
        sourceBusinessId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      applyAllocations(
        input.creditId,
        input.allocations,
        ctx.session.user.id,
        input.sourceBusinessId,
      ),
    ),

  removeAllocation: protectedProcedure
    .input(z.object({ allocationId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      removeAllocation(input.allocationId, ctx.session.user.id),
    ),

  deleteCleansingDonation: protectedProcedure
    .input(z.object({ donationId: z.string() }))
    .mutation(async ({ input }) =>
      deleteInterestCleansingPayment(input.donationId),
    ),
});
