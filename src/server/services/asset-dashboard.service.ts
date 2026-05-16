import { CurrencyEnumType, type Prisma } from '@prisma/client';
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
  const cashWhere: Prisma.BankAssetSnapshotWhereInput = { userId };

  if (filters?.fromDate || filters?.toDate) {
    cashWhere.snapshotDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }

  const [cashSnapshots, stockSnapshots] = await Promise.all([
    prisma.bankAssetSnapshot.findMany({
      where: cashWhere,
      orderBy: { snapshotDate: 'asc' },
      include: {
        entries: {
          select: {
            balance: true,
          },
        },
      },
    }),
    prisma.stockSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotDate: 'asc' },
      include: {
        holdings: {
          where: {
            currency: CurrencyEnumType.AUD,
          },
          select: {
            quantity: true,
            currentPrice: true,
          },
        },
      },
    }),
  ]);

  const stockSnapshotsWithTotals = stockSnapshots.map((snapshot) => ({
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    stockTotal: snapshot.holdings.reduce(
      (sum, holding) =>
        sum + holding.quantity.toNumber() * holding.currentPrice.toNumber(),
      0,
    ),
  }));

  let stockPointer = -1;

  const dataPoints: NetWorthDataPoint[] = cashSnapshots.map((cashSnapshot) => {
    while (
      stockPointer + 1 < stockSnapshotsWithTotals.length &&
      stockSnapshotsWithTotals[stockPointer + 1]!.snapshotDate <=
        cashSnapshot.snapshotDate
    ) {
      stockPointer++;
    }

    const matchedStockSnapshot =
      stockPointer >= 0 ? stockSnapshotsWithTotals[stockPointer] : null;
    const cashTotal = cashSnapshot.entries.reduce(
      (sum, entry) => sum + entry.balance.toNumber(),
      0,
    );
    const stockTotal = matchedStockSnapshot?.stockTotal ?? 0;

    return {
      date: toIsoDate(cashSnapshot.snapshotDate),
      cashTotal,
      stockTotal,
      netWorthTotal: cashTotal + stockTotal,
      cashSnapshotId: cashSnapshot.id,
      stockSnapshotId: matchedStockSnapshot?.id ?? null,
      isStockStale: matchedStockSnapshot
        ? !isSameDay(matchedStockSnapshot.snapshotDate, cashSnapshot.snapshotDate)
        : false,
    };
  });

  const latestCashSnapshot = cashSnapshots[cashSnapshots.length - 1] ?? null;
  const latestCashTotal = latestCashSnapshot
    ? latestCashSnapshot.entries.reduce(
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
