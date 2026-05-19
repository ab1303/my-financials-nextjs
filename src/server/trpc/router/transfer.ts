import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { TRPCError } from '@trpc/server';
import {
  getCandidates,
  searchTransferCandidates,
  linkTransferPair,
  unlinkTransferPair,
  getUnmatchedTransferCount,
  findSimilarUnmatchedPairs,
  batchLinkTransferPairs,
} from '@/server/services/transactions/transfer.service';
import { TRANSFER_CATEGORY } from '@/server/services/transactions/constants';

const getCandidatesSchema = z.object({
  transactionId: z.string().min(1),
});

const linkSchema = z.object({
  debitTransactionId: z.string().min(1),
  creditTransactionId: z.string().min(1),
});

const unlinkSchema = z.object({
  transactionId: z.string().min(1),
});
const suggestSimilarPairsSchema = z.object({
  debitTransactionId: z.string().min(1),
  creditTransactionId: z.string().min(1),
});
const batchLinkSchema = z.object({
  pairs: z
    .array(
      z.object({
        debitTransactionId: z.string().min(1),
        creditTransactionId: z.string().min(1),
      }),
    )
    .min(1),
});

const getPairsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

const getUnmatchedSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export const transferRouter = router({
  getCandidates: protectedProcedure
    .input(getCandidatesSchema)
    .query(async ({ ctx, input }) => {
      return getCandidates({
        prisma: ctx.prisma,
        transactionId: input.transactionId,
        userId: ctx.session.user.id,
      });
    }),

  searchCandidates: protectedProcedure
    .input(z.object({
      transactionId: z.string().min(1),
      search: z.string().optional(),
      bankAccountId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return searchTransferCandidates({
        prisma: ctx.prisma,
        transactionId: input.transactionId,
        userId: ctx.session.user.id,
        search: input.search,
        bankAccountId: input.bankAccountId,
      });
    }),

  link: protectedProcedure
    .input(linkSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await linkTransferPair({
          prisma: ctx.prisma,
          debitTransactionId: input.debitTransactionId,
          creditTransactionId: input.creditTransactionId,
          userId: ctx.session.user.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to link transfer pair',
        });
      }
    }),

  unlink: protectedProcedure
    .input(unlinkSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await unlinkTransferPair({
          prisma: ctx.prisma,
          transactionId: input.transactionId,
          userId: ctx.session.user.id,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to unlink transfer pair',
        });
      }
    }),

  suggestSimilarPairs: protectedProcedure
    .input(suggestSimilarPairsSchema)
    .query(async ({ ctx, input }) => {
      return findSimilarUnmatchedPairs({
        prisma: ctx.prisma,
        userId: ctx.session.user.id,
        debitTransactionId: input.debitTransactionId,
        creditTransactionId: input.creditTransactionId,
      });
    }),

  batchLink: protectedProcedure
    .input(batchLinkSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await batchLinkTransferPairs({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          pairs: input.pairs,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to batch link pairs',
        });
      }
    }),

  getUnmatched: protectedProcedure
    .input(getUnmatchedSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const skip = (input.page - 1) * input.limit;

      const [transactions, total] = await Promise.all([
        (ctx.prisma.transaction as any).findMany({
          where: {
            userId,
            category: TRANSFER_CATEGORY,
            transferLinkedTransactionId: null,
            transferCounterpart: { is: null },
          },
          include: { financialAccount: { include: { bank: true } } },
          orderBy: { date: 'desc' },
          skip,
          take: input.limit,
        }),
        (ctx.prisma.transaction as any).count({
          where: {
            userId,
            category: TRANSFER_CATEGORY,
            transferLinkedTransactionId: null,
            transferCounterpart: { is: null },
          },
        }),
      ]);

      return { transactions, total, page: input.page, totalPages: Math.ceil((total as number) / input.limit) };
    }),

  getUnmatchedCount: protectedProcedure.query(async ({ ctx }) => {
    return getUnmatchedTransferCount({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    });
  }),

  getPairs: protectedProcedure
    .input(getPairsSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const skip = (input.page - 1) * input.limit;

      const [pairs, total] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where: {
            userId,
            type: 'DEBIT',
            category: TRANSFER_CATEGORY,
            transferLinkedTransactionId: { not: null },
          } as any,
          include: {
            bankAccount: { include: { bank: true } },
            transferLinkedTransaction: {
              include: { financialAccount: { include: { bank: true } } },
            },
          } as any,
          orderBy: { date: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.transaction.count({
          where: {
            userId,
            type: 'DEBIT',
            category: TRANSFER_CATEGORY,
            transferLinkedTransactionId: { not: null },
          } as any,
        }),
      ]);

      return { pairs, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),
});

