import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/utils/prisma';

import type {
  CreateStockSnapshotInput,
  CreateStockHoldingInput,
  UpdateStockHoldingInput,
} from '@/server/schema/stock-asset.schema';

// Stock Snapshot Service

export const createStockSnapshot = async (
  userId: string,
  input: CreateStockSnapshotInput,
) => {
  // Create snapshot with holdings in a transaction
  return await prisma.$transaction(async (tx) => {
    // Verify all accounts belong to the user and are BROKERAGE type
    const accountIds = [...new Set(input.holdings.map((h) => h.accountId))];
    const accounts = await tx.business.findMany({
      where: {
        id: { in: accountIds },
        userId,
        type: 'BROKERAGE',
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error(
        'One or more accounts not found, do not belong to user, or are not brokerage accounts',
      );
    }

    // Create the snapshot
    const snapshot = await tx.portfolioSnapshot.create({
      data: {
        snapshotDate: input.snapshotDate,
        userId,
        holdings: {
          create: input.holdings.map((holding) => ({
            ticker: holding.ticker,
            companyName: holding.companyName,
            quantity: holding.quantity,
            buyPrice: holding.buyPrice,
            buyDate: holding.buyDate,
            currentPrice: holding.currentPrice,
            currency: holding.currency,
            plannedTerm: holding.plannedTerm,
            salePrice: holding.salePrice,
            saleDate: holding.saleDate,
            soldQuantity: holding.soldQuantity,
            accountId: holding.accountId,
          })),
        },
      },
      include: {
        holdings: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return snapshot;
  });
};

export const getStockSnapshots = async (
  userId: string,
  filters?: {
    calendarYearId?: string;
    fromDate?: Date;
    toDate?: Date;
  },
) => {
  const where: Prisma.PortfolioSnapshotWhereInput = {
    userId,
  };

  if (filters?.fromDate || filters?.toDate) {
    where.snapshotDate = {};
    if (filters.fromDate) {
      where.snapshotDate.gte = filters.fromDate;
    }
    if (filters.toDate) {
      where.snapshotDate.lte = filters.toDate;
    }
  }

  return await prisma.portfolioSnapshot.findMany({
    where,
    include: {
      holdings: {
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          account: {
            name: 'asc',
          },
        },
      },
    },
    orderBy: {
      snapshotDate: 'desc',
    },
  });
};

export const getMostRecentSnapshot = async (
  userId: string,
  filters?: {
    calendarYearId?: string;
    fromDate?: Date;
    toDate?: Date;
  },
) => {
  const snapshots = await getStockSnapshots(userId, filters);
  return snapshots[0] || null;
};

export const getSnapshotById = async (snapshotId: string, userId: string) => {
  return await prisma.portfolioSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId,
    },
    include: {
      holdings: {
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          account: {
            name: 'asc',
          },
        },
      },
    },
  });
};

export const createStockHolding = async (
  userId: string,
  input: CreateStockHoldingInput,
) => {
  // Verify the snapshot belongs to the user
  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: {
      id: input.snapshotId,
      userId,
    },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found or does not belong to user');
  }

  // Verify the account is a BROKERAGE account owned by the user
  const account = await prisma.business.findFirst({
    where: {
      id: input.accountId,
      userId,
      type: 'BROKERAGE',
    },
  });

  if (!account) {
    throw new Error(
      'Account not found, does not belong to user, or is not a brokerage account',
    );
  }

  return await prisma.stockHolding.create({
    data: {
      ticker: input.ticker,
      companyName: input.companyName,
      quantity: input.quantity,
      buyPrice: input.buyPrice,
      buyDate: input.buyDate,
      currentPrice: input.currentPrice,
      currency: input.currency,
      plannedTerm: input.plannedTerm,
      salePrice: input.salePrice,
      saleDate: input.saleDate,
      soldQuantity: input.soldQuantity,
      accountId: input.accountId,
      snapshotId: input.snapshotId,
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const updateStockHolding = async (
  userId: string,
  input: UpdateStockHoldingInput,
) => {
  // Verify the holding belongs to the user's snapshot
  const holding = await prisma.stockHolding.findFirst({
    where: {
      id: input.holdingId,
      snapshot: {
        userId,
      },
    },
  });

  if (!holding) {
    throw new Error('Holding not found or does not belong to user');
  }

  const updateData: Prisma.StockHoldingUpdateInput = {};

  if (input.ticker !== undefined) updateData.ticker = input.ticker;
  if (input.companyName !== undefined)
    updateData.companyName = input.companyName;
  if (input.quantity !== undefined) updateData.quantity = input.quantity;
  if (input.buyPrice !== undefined) updateData.buyPrice = input.buyPrice;
  if (input.buyDate !== undefined) updateData.buyDate = input.buyDate;
  if (input.currentPrice !== undefined)
    updateData.currentPrice = input.currentPrice;
  if (input.currency !== undefined) updateData.currency = input.currency;
  if (input.plannedTerm !== undefined)
    updateData.plannedTerm = input.plannedTerm;
  if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
  if (input.saleDate !== undefined) updateData.saleDate = input.saleDate;
  if (input.soldQuantity !== undefined)
    updateData.soldQuantity = input.soldQuantity;

  return await prisma.stockHolding.update({
    where: {
      id: input.holdingId,
    },
    data: updateData,
    include: {
      account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const deleteStockHolding = async (holdingId: string, userId: string) => {
  // Verify the holding belongs to the user's snapshot
  const holding = await prisma.stockHolding.findFirst({
    where: {
      id: holdingId,
      snapshot: {
        userId,
      },
    },
  });

  if (!holding) {
    throw new Error('Holding not found or does not belong to user');
  }

  return await prisma.stockHolding.delete({
    where: {
      id: holdingId,
    },
  });
};

export const deleteStockSnapshot = async (
  snapshotId: string,
  userId: string,
) => {
  // Verify the snapshot belongs to the user
  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId,
    },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found or does not belong to user');
  }

  // Delete snapshot (cascade will delete holdings)
  return await prisma.portfolioSnapshot.delete({
    where: {
      id: snapshotId,
    },
  });
};

// Get aggregated totals for a snapshot
export const getSnapshotTotals = async (snapshotId: string, userId: string) => {
  const snapshot = await getSnapshotById(snapshotId, userId);

  if (!snapshot) {
    return null;
  }

  // Calculate totals by account and currency
  const accountTotals = snapshot.holdings.reduce(
    (acc, holding) => {
      const accountId = holding.accountId;
      const accountName = holding.account.name;
      const currency = holding.currency;
      const key = `${accountId}-${currency}`;

      if (!acc[key]) {
        acc[key] = {
          accountId,
          accountName,
          currency,
          totalValue: 0,
          totalCostBasis: 0,
          totalUnrealizedPL: 0,
          totalRealizedPL: 0,
          holdings: [],
        };
      }

      // Calculate holding metrics
      const costBasis = Number(holding.buyPrice) * Number(holding.quantity);
      const marketValue =
        Number(holding.currentPrice) * Number(holding.quantity);
      const unrealizedPL = marketValue - costBasis;

      let realizedPL = 0;
      if (holding.soldQuantity) {
        const soldCostBasis =
          Number(holding.buyPrice) * Number(holding.soldQuantity);
        const soldMarketValue =
          Number(holding.salePrice) * Number(holding.soldQuantity);
        realizedPL = soldMarketValue - soldCostBasis;
      }

      acc[key].totalValue += marketValue;
      acc[key].totalCostBasis += costBasis;
      acc[key].totalUnrealizedPL += unrealizedPL;
      acc[key].totalRealizedPL += realizedPL;

      acc[key].holdings.push({
        holdingId: holding.id,
        ticker: holding.ticker,
        companyName: holding.companyName,
        quantity: Number(holding.quantity),
        buyPrice: Number(holding.buyPrice),
        currentPrice: Number(holding.currentPrice),
        costBasis,
        marketValue,
        unrealizedPL,
        realizedPL,
        soldQuantity: holding.soldQuantity ? Number(holding.soldQuantity) : 0,
      });

      return acc;
    },
    {} as Record<
      string,
      {
        accountId: string;
        accountName: string;
        currency: string;
        totalValue: number;
        totalCostBasis: number;
        totalUnrealizedPL: number;
        totalRealizedPL: number;
        holdings: Array<{
          holdingId: string;
          ticker: string;
          companyName: string;
          quantity: number;
          buyPrice: number;
          currentPrice: number;
          costBasis: number;
          marketValue: number;
          unrealizedPL: number;
          realizedPL: number;
          soldQuantity: number;
        }>;
      }
    >,
  );

  // Aggregate by currency
  const currencyTotals = Object.values(accountTotals).reduce(
    (acc, account) => {
      const currency = account.currency;

      if (!acc[currency]) {
        acc[currency] = {
          currency,
          totalValue: 0,
          totalCostBasis: 0,
          totalUnrealizedPL: 0,
          totalRealizedPL: 0,
          accounts: [],
        };
      }

      acc[currency].totalValue += account.totalValue;
      acc[currency].totalCostBasis += account.totalCostBasis;
      acc[currency].totalUnrealizedPL += account.totalUnrealizedPL;
      acc[currency].totalRealizedPL += account.totalRealizedPL;
      acc[currency].accounts.push(account);

      return acc;
    },
    {} as Record<
      string,
      {
        currency: string;
        totalValue: number;
        totalCostBasis: number;
        totalUnrealizedPL: number;
        totalRealizedPL: number;
        accounts: Array<{
          accountId: string;
          accountName: string;
          currency: string;
          totalValue: number;
          totalCostBasis: number;
          totalUnrealizedPL: number;
          totalRealizedPL: number;
          holdings: Array<{
            holdingId: string;
            ticker: string;
            companyName: string;
            quantity: number;
            buyPrice: number;
            currentPrice: number;
            costBasis: number;
            marketValue: number;
            unrealizedPL: number;
            realizedPL: number;
            soldQuantity: number;
          }>;
        }>;
      }
    >,
  );

  return {
    snapshotId: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    currencies: Object.values(currencyTotals),
  };
};
