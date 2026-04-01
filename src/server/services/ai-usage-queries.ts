import { cache } from 'react';
import { prisma } from '@/server/db/client';
import { getUSDtoAUDRate } from '@/server/services/exchange-rate.service';

/**
 * Fetch AI usage summary for a user, scoped by import type + date range.
 * Wrapped in React.cache() for per-request deduplication.
 */
export const getAIUsageSummary = cache(
  async (
    userId: string,
    importType: 'EXPENSE' | 'BANK_ASSET' | 'STOCK',
    dateFrom: Date,
    dateTo: Date,
  ) => {
    const [aggregate, distinctSessions, distinctImages] = await Promise.all([
      prisma.aIUsageLog.aggregate({
        where: {
          userId,
          importType,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: { estimatedCostUSD: true, totalTokens: true },
      }),
      prisma.aIUsageLog.findMany({
        where: {
          userId,
          importType,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: { sessionId: true },
        distinct: ['sessionId'],
      }),
      prisma.aIUsageLog.findMany({
        where: {
          userId,
          importType,
          createdAt: { gte: dateFrom, lte: dateTo },
          imageId: { not: null },
        },
        select: { imageId: true },
        distinct: ['imageId'],
      }),
    ]);

    return {
      totalCostUSD: aggregate._sum.estimatedCostUSD ?? 0,
      totalTokens: aggregate._sum.totalTokens ?? 0,
      totalSessions: distinctSessions.length,
      totalImages: distinctImages.length,
    };
  },
);

/**
 * Fetch AI usage for all import types for the current calendar month.
 * Used on the dashboard.
 */
export const getDashboardAIUsage = cache(async (userId: string) => {
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const types = ['EXPENSE', 'BANK_ASSET', 'STOCK'] as const;

  const results = await Promise.all(
    types.map((importType) =>
      getAIUsageSummary(userId, importType, dateFrom, dateTo),
    ),
  );

  return types.map((importType, i) => ({
    importType,
    ...results[i]!,
  }));
});

/**
 * Fetch all users' AI usage for the admin overview.
 */
export const getAllUsersAIUsage = cache(
  async (dateFrom: Date, dateTo: Date) => {
    const rows = await prisma.aIUsageLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      _sum: { estimatedCostUSD: true, totalTokens: true },
    });

    const userIds = rows.map((r) => r.userId);

    const [users, sessionCounts, imageCounts] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }),
      Promise.all(
        userIds.map((userId) =>
          prisma.aIUsageLog
            .findMany({
              where: { userId, createdAt: { gte: dateFrom, lte: dateTo } },
              select: { sessionId: true },
              distinct: ['sessionId'],
            })
            .then((r) => ({ userId, count: r.length })),
        ),
      ),
      Promise.all(
        userIds.map((userId) =>
          prisma.aIUsageLog
            .findMany({
              where: {
                userId,
                createdAt: { gte: dateFrom, lte: dateTo },
                imageId: { not: null },
              },
              select: { imageId: true },
              distinct: ['imageId'],
            })
            .then((r) => ({ userId, count: r.length })),
        ),
      ),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const sessionMap = new Map(sessionCounts.map((s) => [s.userId, s.count]));
    const imageMap = new Map(imageCounts.map((s) => [s.userId, s.count]));

    return rows.map((r) => ({
      userId: r.userId,
      userName: userMap.get(r.userId)?.name ?? 'Unknown',
      email: userMap.get(r.userId)?.email ?? '',
      totalCostUSD: r._sum.estimatedCostUSD ?? 0,
      totalTokens: r._sum.totalTokens ?? 0,
      totalSessions: sessionMap.get(r.userId) ?? 0,
      totalImages: imageMap.get(r.userId) ?? 0,
    }));
  },
);

/**
 * Fetch per-category breakdown for a specific user. Admin only.
 */
export const getUserCategoryBreakdown = cache(
  async (userId: string, dateFrom: Date, dateTo: Date) => {
    const [user, rows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['importType'],
        where: { userId, createdAt: { gte: dateFrom, lte: dateTo } },
        _sum: {
          estimatedCostUSD: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        },
      }),
    ]);

    if (!user) throw new Error('User not found');

    const details = await Promise.all(
      rows.map(async (r) => {
        const [sessions, images] = await Promise.all([
          prisma.aIUsageLog.findMany({
            where: {
              userId,
              importType: r.importType,
              createdAt: { gte: dateFrom, lte: dateTo },
            },
            select: { sessionId: true },
            distinct: ['sessionId'],
          }),
          prisma.aIUsageLog.findMany({
            where: {
              userId,
              importType: r.importType,
              createdAt: { gte: dateFrom, lte: dateTo },
              imageId: { not: null },
            },
            select: { imageId: true },
            distinct: ['imageId'],
          }),
        ]);
        return {
          importType: r.importType,
          totalSessions: sessions.length,
          totalImages: images.length,
        };
      }),
    );

    const detailMap = new Map(details.map((d) => [d.importType, d]));

    return {
      user,
      categories: rows.map((r) => ({
        importType: r.importType,
        totalCostUSD: r._sum.estimatedCostUSD ?? 0,
        promptTokens: r._sum.promptTokens ?? 0,
        completionTokens: r._sum.completionTokens ?? 0,
        totalTokens: r._sum.totalTokens ?? 0,
        totalImages: detailMap.get(r.importType)?.totalImages ?? 0,
        totalSessions: detailMap.get(r.importType)?.totalSessions ?? 0,
      })),
    };
  },
);

/**
 * Get USD→AUD rate. Cached at service level (1h TTL).
 */
export const getExchangeRate = cache(async () => {
  return getUSDtoAUDRate();
});
