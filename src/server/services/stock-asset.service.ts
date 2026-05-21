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
    const accounts = await tx.financialAccount.findMany({
      where: {
        id: { in: accountIds },
        userId,
        institution: { type: 'BROKERAGE' },
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error(
        'One or more accounts not found, do not belong to user, or are not brokerage accounts',
      );
    }

    // Create the snapshot
    // Phase 3: buyDate is optional/nullable - holdings can have null buyDate
    const snapshot = await tx.portfolioSnapshot.create({
      data: {
        snapshotDate: input.snapshotDate,
        usdToAudRate: input.usdToAudRate ?? null,
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
                institution: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Create cash balance records if provided (filter out amounts <= 0)
    if (input.cashBalances && input.cashBalances.length > 0) {
      const validCashBalances = input.cashBalances.filter((cb) => cb.amount > 0);
      
      if (validCashBalances.length > 0) {
        await tx.brokerageCashBalance.createMany({
          data: validCashBalances.map((cb) => ({
            amount: cb.amount,
            currency: cb.currency,
            accountId: cb.accountId,
            snapshotId: snapshot.id,
          })),
        });
      }
    }

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
              institution: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: {
          account: {
            institution: { name: 'asc' },
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
              institution: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: {
          account: {
            institution: { name: 'asc' },
          },
        },
      },
      cashBalances: {
        include: {
          account: {
            select: {
              id: true,
              name: true,
              institution: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
};

export const createStockHolding= async (
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

  // Verify the account is a brokerage sub-account owned by the user
  const account = await prisma.financialAccount.findFirst({
    where: {
      id: input.accountId,
      userId,
      institution: { type: 'BROKERAGE' },
    },
  });

  if (!account) {
    throw new Error(
      'Brokerage sub-account not found or not owned by user',
    );
  }

  // Phase 3: buyDate is optional/nullable - holdings can be created without a buy date
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
          institution: { select: { id: true, name: true } },
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
  // Phase 3: Supports setting buyDate to null (optional/nullable)
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
          institution: { select: { id: true, name: true } },
        },
      },
    },
  });
};

export const deleteStockHolding= async (holdingId: string, userId: string) => {
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

export const updateSnapshotFxRate = async (
  snapshotId: string,
  userId: string,
  usdToAudRate: number | null,
) => {
  const snapshot = await prisma.portfolioSnapshot.findFirst({
    where: { id: snapshotId, userId },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found or does not belong to user');
  }

  return await prisma.portfolioSnapshot.update({
    where: { id: snapshotId },
    data: { usdToAudRate },
  });
};

/**
 * Get aggregated totals for a snapshot (Phase 3: Null buyDate Handling)
 *
 * Note: This function properly handles holdings with null buyDate.
 * When a holding has a null buyDate, the holding is still included in aggregations.
 * Individual P/L calculations are performed correctly - buyDate is only used for:
 * - Calculating holding period (defaults to 0 months if null)
 * - Determining CGT eligibility (false if null)
 *
 * The aggregation logic sums up market values, costs, and P/L across all holdings
 * regardless of whether buyDate is null or not.
 *
 * @param snapshotId - The portfolio snapshot ID to calculate totals for
 * @param userId - The user ID (for authorization)
 * @returns Aggregated totals by account and currency, or null if snapshot not found
 */
export const getSnapshotTotals = async (snapshotId: string, userId: string) => {
  const snapshot = await getSnapshotById(snapshotId, userId);

  if (!snapshot) {
    return null;
  }

  // Calculate totals by account and currency
  // Note: Holdings with null buyDate are included in totals (Phase 3)
  const accountTotals = snapshot.holdings.reduce(
    (acc, holding) => {
      const accountId = holding.accountId;
      const accountName = `${holding.account.institution.name} — ${holding.account.name}`;
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
          totalCash: 0,
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
        totalCash: number;
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

  // Build cash balance summaries and add to currency totals
  const cashBalanceSummaries = snapshot.cashBalances.map((cashBalance) => ({
    accountId: cashBalance.accountId,
    accountName: `${cashBalance.account.institution.name} — ${cashBalance.account.name}`,
    currency: cashBalance.currency,
    amount: Number(cashBalance.amount),
  }));

  // Add cash totals to each currency
  for (const cashBalance of cashBalanceSummaries) {
    if (!currencyTotals[cashBalance.currency]) {
      currencyTotals[cashBalance.currency] = {
        currency: cashBalance.currency,
        totalValue: 0,
        totalCostBasis: 0,
        totalUnrealizedPL: 0,
        totalRealizedPL: 0,
        totalCash: 0,
        accounts: [],
      };
    }
    currencyTotals[cashBalance.currency]!.totalCash += cashBalance.amount;
  }

  return {
    snapshotId: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    usdToAudRate: snapshot.usdToAudRate ? Number(snapshot.usdToAudRate) : null,
    accounts: Object.values(accountTotals),
    currencyTotals: Object.values(currencyTotals),
    cashBalances: cashBalanceSummaries,
  };
};

/**
 * Get all brokerage sub-accounts (FinancialAccounts) for a user.
 */
export const getBrokerageAccounts = async (userId: string) => {
  return await prisma.financialAccount.findMany({
    where: {
      userId,
      institution: { type: 'BROKERAGE' },
    },
    select: {
      id: true,
      name: true,
      institution: { select: { id: true, name: true } },
    },
    orderBy: [
      { institution: { name: 'asc' } },
      { name: 'asc' },
    ],
  });
};

/**
 * Create a new brokerage sub-account under an existing Business/BROKERAGE.
 */
export const createBrokerageSubAccount = async (
  userId: string,
  input: { businessId: string; name: string },
) => {
  // Verify the Business/BROKERAGE institution exists and either:
  // - is global (userId null), or
  // - is owned by the user
  const business = await prisma.business.findFirst({
    where: {
      id: input.businessId,
      type: 'BROKERAGE',
      OR: [
        { userId: null },        // Global institution
        { userId },              // User-owned institution
      ],
    },
  });

  if (!business) {
    throw new Error('Brokerage institution not found or not owned by user');
  }

  return await prisma.financialAccount.create({
    data: {
      name: input.name,
      institutionId: input.businessId,
      userId,
    },
    select: {
      id: true,
      name: true,
      institution: { select: { id: true, name: true } },
    },
  });
};
