import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '@/server/trpc/trpc';
import { prisma } from '@/server/db/client';
import { getUSDtoAUDRate } from '@/server/services/exchange-rate.service';

const dateRangeSchema = z.object({
  dateFrom: z.date(),
  dateTo: z.date(),
});

export const aiUsageRouter = router({
  /**
   * Get AI usage summary for the current user filtered by import type and date range.
   */
  getUsageSummary: protectedProcedure
    .input(
      z.object({
        importType: z.enum(['EXPENSE', 'BANK_ASSET', 'STOCK']),
        dateFrom: z.date(),
        dateTo: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await prisma.aIUsageLog.aggregate({
        where: {
          userId,
          importType: input.importType,
          createdAt: {
            gte: input.dateFrom,
            lte: input.dateTo,
          },
        },
        _sum: {
          estimatedCostUSD: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        },
        _count: {
          id: true,
        },
      });

      // Count distinct images and sessions
      const distinctCounts = await prisma.aIUsageLog.findMany({
        where: {
          userId,
          importType: input.importType,
          createdAt: {
            gte: input.dateFrom,
            lte: input.dateTo,
          },
        },
        select: {
          imageId: true,
          sessionId: true,
        },
        distinct: ['sessionId'],
      });

      const distinctImages = await prisma.aIUsageLog.findMany({
        where: {
          userId,
          importType: input.importType,
          createdAt: {
            gte: input.dateFrom,
            lte: input.dateTo,
          },
          imageId: { not: null },
        },
        select: { imageId: true },
        distinct: ['imageId'],
      });

      return {
        totalCostUSD: result._sum.estimatedCostUSD ?? 0,
        totalImages: distinctImages.length,
        totalSessions: distinctCounts.length,
        totalTokens: result._sum.totalTokens ?? 0,
      };
    }),

  /**
   * Get AI usage for the current user's dashboard (current calendar month).
   */
  getDashboardUsage: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const results = await prisma.aIUsageLog.groupBy({
      by: ['importType'],
      where: {
        userId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _sum: {
        estimatedCostUSD: true,
        totalTokens: true,
      },
    });

    return results.map((r) => ({
      importType: r.importType,
      totalCostUSD: r._sum.estimatedCostUSD ?? 0,
      totalTokens: r._sum.totalTokens ?? 0,
    }));
  }),

  /**
   * Get live USD→AUD exchange rate (server-side cache, 1h TTL).
   */
  getExchangeRate: protectedProcedure.query(async () => {
    const rate = await getUSDtoAUDRate();
    return { rate, currency: 'AUD' as const };
  }),

  /**
   * Admin: Get all users' AI usage within a date range.
   */
  getAllUsersUsage: adminProcedure
    .input(dateRangeSchema)
    .query(async ({ input }) => {
      const rows = await prisma.aIUsageLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: input.dateFrom, lte: input.dateTo },
        },
        _sum: {
          estimatedCostUSD: true,
          totalTokens: true,
        },
      });

      // Fetch user details
      const userIds = rows.map((r) => r.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // Count distinct images/sessions per user
      const detailsPromises = userIds.map(async (userId) => {
        const [distinctSessions, distinctImages] = await Promise.all([
          prisma.aIUsageLog.findMany({
            where: {
              userId,
              createdAt: { gte: input.dateFrom, lte: input.dateTo },
            },
            select: { sessionId: true },
            distinct: ['sessionId'],
          }),
          prisma.aIUsageLog.findMany({
            where: {
              userId,
              createdAt: { gte: input.dateFrom, lte: input.dateTo },
              imageId: { not: null },
            },
            select: { imageId: true },
            distinct: ['imageId'],
          }),
        ]);
        return {
          userId,
          totalSessions: distinctSessions.length,
          totalImages: distinctImages.length,
        };
      });

      const details = await Promise.all(detailsPromises);
      const detailMap = new Map(details.map((d) => [d.userId, d]));

      return rows.map((r) => {
        const user = userMap.get(r.userId);
        const detail = detailMap.get(r.userId);
        return {
          userId: r.userId,
          userName: user?.name ?? 'Unknown',
          email: user?.email ?? '',
          totalCostUSD: r._sum.estimatedCostUSD ?? 0,
          totalTokens: r._sum.totalTokens ?? 0,
          totalImages: detail?.totalImages ?? 0,
          totalSessions: detail?.totalSessions ?? 0,
        };
      });
    }),

  /**
   * Admin: Get per-category AI usage breakdown for a specific user.
   */
  getUserCategoryBreakdown: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        dateFrom: z.date(),
        dateTo: z.date(),
      }),
    )
    .query(async ({ input }) => {
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const rows = await prisma.aIUsageLog.groupBy({
        by: ['importType'],
        where: {
          userId: input.userId,
          createdAt: { gte: input.dateFrom, lte: input.dateTo },
        },
        _sum: {
          estimatedCostUSD: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        },
      });

      // Count distinct images/sessions per import type
      const detailsPromises = rows.map(async (r) => {
        const [distinctSessions, distinctImages] = await Promise.all([
          prisma.aIUsageLog.findMany({
            where: {
              userId: input.userId,
              importType: r.importType,
              createdAt: { gte: input.dateFrom, lte: input.dateTo },
            },
            select: { sessionId: true },
            distinct: ['sessionId'],
          }),
          prisma.aIUsageLog.findMany({
            where: {
              userId: input.userId,
              importType: r.importType,
              createdAt: { gte: input.dateFrom, lte: input.dateTo },
              imageId: { not: null },
            },
            select: { imageId: true },
            distinct: ['imageId'],
          }),
        ]);
        return {
          importType: r.importType,
          totalSessions: distinctSessions.length,
          totalImages: distinctImages.length,
        };
      });

      const details = await Promise.all(detailsPromises);
      const detailMap = new Map(details.map((d) => [d.importType, d]));

      return {
        user,
        categories: rows.map((r) => {
          const detail = detailMap.get(r.importType);
          return {
            importType: r.importType,
            totalCostUSD: r._sum.estimatedCostUSD ?? 0,
            promptTokens: r._sum.promptTokens ?? 0,
            completionTokens: r._sum.completionTokens ?? 0,
            totalTokens: r._sum.totalTokens ?? 0,
            totalImages: detail?.totalImages ?? 0,
            totalSessions: detail?.totalSessions ?? 0,
          };
        }),
      };
    }),
});
