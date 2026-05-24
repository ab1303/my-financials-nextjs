import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createRule,
  deleteRule,
  findSimilarTransactions,
  listRules,
  toggleRule,
  applyRuleToPast,
} from "@/server/services/transactions/category-rule.service";
import { protectedProcedure, router } from "@/server/trpc/trpc";

export const categoryRuleRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        pattern: z.string().min(1),
        matchType: z.enum(["CONTAINS", "STARTS_WITH", "EXACT"]),
        category: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createRule({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          name: input.name,
          pattern: input.pattern,
          matchType: input.matchType,
          category: input.category,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Failed to create rule",
        });
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return listRules({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    });
  }),

  toggle: protectedProcedure
    .input(z.object({ ruleId: z.string().min(1), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await toggleRule({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          ruleId: input.ruleId,
          isActive: input.isActive,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Failed to toggle rule",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ ruleId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteRule({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          ruleId: input.ruleId,
        });
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: err instanceof Error ? err.message : "Failed to delete rule",
        });
      }
    }),

  findSimilar: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1),
        excludeTransactionId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const count = await findSimilarTransactions({
        prisma: ctx.prisma,
        userId: ctx.session.user.id,
        description: input.description,
        excludeTransactionId: input.excludeTransactionId,
      });
      return { count };
    }),

  applyToPast: protectedProcedure
    .input(z.object({ ruleId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedCount = await applyRuleToPast({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          ruleId: input.ruleId,
        });
        return { updatedCount };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Failed to apply rule",
        });
      }
    }),
});
