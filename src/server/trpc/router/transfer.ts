import type { Prisma } from '@prisma/client';
import { TransferOrphanResolution } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  ORPHAN_RESOLUTION_DAYS,
  TRANSFER_CATEGORY,
} from '@/server/services/transactions/constants';
import {
  batchLinkTransferPairs,
  findSimilarUnmatchedPairs,
  getCandidates,
  getUnmatchedTransferCount,
  linkTransferPair,
  searchTransferCandidates,
  unlinkTransferPair,
} from '@/server/services/transactions/transfer.service';
import { protectedProcedure, router } from '@/server/trpc/trpc';

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
    .input(
      z.object({
        transactionId: z.string().min(1),
        search: z.string().optional(),
        bankAccountId: z.string().optional(),
      }),
    )
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
          message:
            err instanceof Error ? err.message : 'Failed to link transfer pair',
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
          message:
            err instanceof Error
              ? err.message
              : 'Failed to unlink transfer pair',
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
          message:
            err instanceof Error ? err.message : 'Failed to batch link pairs',
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
          include: { financialAccount: { include: { institution: true } } },
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

      return {
        transactions,
        total,
        page: input.page,
        totalPages: Math.ceil((total as number) / input.limit),
      };
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
            financialAccount: { include: { institution: true } },
            transferLinkedTransaction: {
              include: { financialAccount: { include: { institution: true } } },
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

      return {
        pairs,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  getOrphanedTransfers: protectedProcedure
    .input(
      z.object({
        bankAccountId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ORPHAN_RESOLUTION_DAYS);

      return (ctx.prisma.transaction as any).findMany({
        where: {
          userId: ctx.session.user.id,
          category: TRANSFER_CATEGORY,
          transferLinkedTransactionId: null,
          transferCounterpart: { is: null }, // exclude CREDIT legs already linked as counterparts
          orphanResolution: null, // only show unresolved orphans
          date: { lt: cutoffDate },
          ...(input.bankAccountId
            ? { bankAccountId: input.bankAccountId }
            : {}),
        },
        include: {
          financialAccount: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      });
    }),

  resolveOrphan: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        resolution: z.enum(['EXCLUDED', 'EXPENSE', 'INCOME']),
        newCategory: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Guard: verify it IS an orphaned transfer owned by this user
      const tx = await (ctx.prisma.transaction as any).findFirst({
        where: {
          id: input.transactionId,
          userId: ctx.session.user.id,
          category: TRANSFER_CATEGORY,
          transferLinkedTransactionId: null,
        },
      });

      if (!tx) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Orphaned transfer not found',
        });
      }

      if (
        (input.resolution === 'EXPENSE' || input.resolution === 'INCOME') &&
        !input.newCategory
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'newCategory required for EXPENSE/INCOME resolution',
        });
      }

      return (ctx.prisma.transaction as any).update({
        where: { id: input.transactionId },
        data: {
          orphanResolution: input.resolution,
          ...(input.resolution !== 'EXCLUDED' && input.newCategory
            ? { category: input.newCategory }
            : {}),
        },
      });
    }),

  getResolvedOrphans: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      return (ctx.prisma.transaction as any).findMany({
        where: {
          userId: ctx.session.user.id,
          category: TRANSFER_CATEGORY,
          transferLinkedTransactionId: null,
          transferCounterpart: { is: null },
          orphanResolution: { not: null },
        },
        include: {
          financialAccount: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
        take: input.limit,
      });
    }),

  resetOrphanResolution: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tx = await (ctx.prisma.transaction as any).findFirst({
        where: {
          id: input.transactionId,
          userId: ctx.session.user.id,
          transferLinkedTransactionId: null,
          orphanResolution: { not: null },
        },
      });

      if (!tx) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Resolved orphan not found',
        });
      }

      return (ctx.prisma.transaction as any).update({
        where: { id: input.transactionId },
        data: {
          orphanResolution: null,
          category: TRANSFER_CATEGORY,
        },
      });
    }),

  getLinkedTransferPairs: protectedProcedure.query(async ({ ctx }) => {
    return (ctx.prisma.transaction as any).findMany({
      where: {
        userId: ctx.session.user.id,
        category: TRANSFER_CATEGORY,
        type: 'DEBIT',
        transferLinkedTransactionId: { not: null },
      },
      include: {
        financialAccount: { select: { name: true } },
        transferLinkedTransaction: {
          include: { financialAccount: { select: { name: true } } },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }),

  runRetroactiveDetection: protectedProcedure.mutation(async ({ ctx }) => {
    const { runRetroactiveDetection } =
      await import('@/server/services/transactions/transfer.service');
    return runRetroactiveDetection({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    });
  }),

  getExcludedTransferSummary: protectedProcedure
    .input(z.object({ year: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.TransactionWhereInput = {
        userId: ctx.session.user.id,
        category: TRANSFER_CATEGORY,
        ...(input.year
          ? {
              date: {
                gte: new Date(input.year, 0, 1),
                lte: new Date(input.year, 11, 31, 23, 59, 59),
              },
            }
          : {}),
      };

      const [count, aggregate] = await Promise.all([
        ctx.prisma.transaction.count({ where }),
        ctx.prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      ]);

      return {
        count,
        totalAmount: Number(aggregate._sum.amount ?? 0),
      };
    }),
});
