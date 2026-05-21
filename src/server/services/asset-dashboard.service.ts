import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import type {
  NetWorthDataPoint,
  NetWorthTrendFilters,
  NetWorthTrendResponse,
} from '@/types/asset-dashboard.types';
import { prisma } from '@/server/utils/prisma';

const toIsoDate = (date: Date) => date.toISOString().split('T')[0] ?? '';

const isSameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

export const resolveDateRangeFromCalendarYear = async (calendarYearId: string) => {
  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
  });

  if (!calendarYear) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Calendar year not found',
    });
  }

  return {
    fromDate: new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1),
    toDate: new Date(
      calendarYear.toYear,
      calendarYear.toMonth,
      0,
      23,
      59,
      59,
      999,
    ),
  };
};

export const getNetWorthTrend = async (
  userId: string,
  filters?: NetWorthTrendFilters,
): Promise<NetWorthTrendResponse> => {
  const cashWhere: Prisma.BankBalanceSnapshotWhereInput = { userId };

  if (filters?.fromDate || filters?.toDate) {
    cashWhere.snapshotDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }

  const [cashSnapshots, stockSnapshots] = await Promise.all([
    prisma.bankBalanceSnapshot.findMany({
      where: cashWhere,
      orderBy: { snapshotDate: 'asc' },
      include: {
        balanceRecords: {
          select: {
            balance: true,
          },
        },
      },
    }),
    prisma.portfolioSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotDate: 'asc' },
      select: {
        id: true,
        snapshotDate: true,
        usdToAudRate: true,
        holdings: {
          select: {
            quantity: true,
            currentPrice: true,
            currency: true,
          },
        },
        cashBalances: {
          select: {
            amount: true,
            currency: true,
          },
        },
      },
    }),
  ]);

  const stockSnapshotsWithTotals = stockSnapshots.map((snapshot) => {
    const usdToAudRate = snapshot.usdToAudRate
      ? Number(snapshot.usdToAudRate)
      : null;

    // Calculate holdings total
    const holdingsTotal = snapshot.holdings.reduce((sum, holding) => {
      const value = Number(holding.quantity) * Number(holding.currentPrice);
      if (holding.currency === 'AUD') return sum + value;
      if (holding.currency === 'USD' && usdToAudRate) return sum + value * usdToAudRate;
      return sum; // USD with no rate: skip gracefully
    }, 0);

    // Calculate cash balances total
    const cashAud = snapshot.cashBalances
      .filter((cb) => cb.currency === 'AUD')
      .reduce((sum, cb) => sum + Number(cb.amount), 0);
    const cashUsd = snapshot.cashBalances
      .filter((cb) => cb.currency === 'USD')
      .reduce((sum, cb) => sum + Number(cb.amount), 0);

    // Combine holdings and cash for total
    const stockTotal = holdingsTotal + cashAud + (usdToAudRate ? cashUsd * usdToAudRate : 0);

    return {
      id: snapshot.id,
      snapshotDate: snapshot.snapshotDate,
      stockTotal,
    };
  });

  const cashByDate = new Map(
    cashSnapshots.map((s) => [toIsoDate(s.snapshotDate), s]),
  );
  const stockByDate = new Map(
    stockSnapshotsWithTotals.map((s) => [toIsoDate(s.snapshotDate), s]),
  );

  const allDates = Array.from(
    new Set([...cashByDate.keys(), ...stockByDate.keys()]),
  ).sort();

  let lastCash: (typeof cashSnapshots)[0] | null = null;
  let lastStock: (typeof stockSnapshotsWithTotals)[0] | null = null;

  const dataPoints: NetWorthDataPoint[] = allDates.map((dateStr) => {
    lastCash = cashByDate.get(dateStr) ?? lastCash;
    lastStock = stockByDate.get(dateStr) ?? lastStock;

    const cashTotal = lastCash
      ? lastCash.balanceRecords.reduce(
          (sum, entry) => sum + entry.balance.toNumber(),
          0,
        )
      : 0;

    return {
      date: dateStr,
      cashTotal,
      stockTotal: lastStock?.stockTotal ?? 0,
      netWorthTotal: cashTotal + (lastStock?.stockTotal ?? 0),
      cashSnapshotId: lastCash?.id ?? '',
      stockSnapshotId: lastStock?.id ?? null,
      isStockStale: lastStock && cashByDate.get(dateStr)
        ? !isSameDay(lastStock.snapshotDate, cashByDate.get(dateStr)!.snapshotDate)
        : false,
    };
  });

  const latestCashSnapshot = cashSnapshots[cashSnapshots.length - 1] ?? null;
  const latestCashTotal = latestCashSnapshot
    ? latestCashSnapshot.balanceRecords.reduce(
        (sum, entry) => sum + entry.balance.toNumber(),
        0,
      )
    : 0;
  const latestStockSnapshot =
    stockSnapshotsWithTotals[stockSnapshotsWithTotals.length - 1] ?? null;
  const latestStockTotal = latestStockSnapshot?.stockTotal ?? 0;

  return {
    dataPoints,
    latestCashTotal,
    latestStockTotal,
    latestNetWorth: latestCashTotal + latestStockTotal,
    latestCashDate: latestCashSnapshot
      ? toIsoDate(latestCashSnapshot.snapshotDate)
      : null,
    latestStockDate: latestStockSnapshot
      ? toIsoDate(latestStockSnapshot.snapshotDate)
      : null,
  };
};
