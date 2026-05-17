import { TRPCError } from '@trpc/server';
import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';
import {
  createRule,
  deleteRule,
  listRules,
  toggleRule,
  updateRule,
} from '@/server/services/transactions/transfer-rule.service';
import { protectedProcedure, router } from '@/server/trpc/trpc';

export const transferRuleRouter = router({
  createRule: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        amountExact: z.number().positive(),
        debitKeywords: z.array(z.string()),
        creditKeywords: z.array(z.string()),
        maxDayGap: z.number().int().min(0).max(30),
        debitBankAccountId: z.string().nullable(),
        creditBankAccountId: z.string().nullable(),
        confidenceThreshold: z.number().int().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createRule({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          name: input.name,
          amountExact: new Decimal(input.amountExact),
          debitKeywords: input.debitKeywords,
          creditKeywords: input.creditKeywords,
          maxDayGap: input.maxDayGap,
          debitBankAccountId: input.debitBankAccountId,
          creditBankAccountId: input.creditBankAccountId,
          confidenceThreshold: input.confidenceThreshold,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to create rule',
        });
      }
    }),

  listRules: protectedProcedure.query(async ({ ctx }) => {
    return listRules({ prisma: ctx.prisma, userId: ctx.session.user.id });
  }),

  toggleRule: protectedProcedure
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
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to toggle rule',
        });
      }
    }),

  deleteRule: protectedProcedure
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
          code: 'NOT_FOUND',
          message: err instanceof Error ? err.message : 'Failed to delete rule',
        });
      }
    }),

  updateRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.string().min(1),
        name: z.string().min(1).optional(),
        maxDayGap: z.number().int().min(0).max(30).optional(),
        confidenceThreshold: z.number().int().min(0).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { ruleId, ...rest } = input;
        return await updateRule({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          ruleId,
          ...rest,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to update rule',
        });
      }
    }),

  getJobResults: protectedProcedure
    .input(z.object({ importSessionId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const results = await (ctx.prisma.transferMatchJobResult as any).findMany({
        where: {
          userId,
          ...(input.importSessionId && { importSessionId: input.importSessionId }),
        },
        include: { rule: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return results.map((r: any) => ({
        id: r.id,
        importSessionId: r.importSessionId,
        ruleId: r.ruleId,
        ruleName: r.rule?.name ?? null,
        autoLinkedCount: r.autoLinkedCount,
        flaggedCount: r.flaggedCount,
        skippedCount: r.skippedCount,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
    }),
});
