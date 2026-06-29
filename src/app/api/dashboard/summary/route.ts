import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import type { DashboardSummaryResponse } from '@/server/models/dashboard';
import { getNetWorthTrend } from '@/server/services/asset-dashboard.service';
import { getCalendarYears } from '@/server/services/calendar-year.service';
import {
  getMonthlyIncomeExpenseTrend,
  getTopExpenseCategories,
} from '@/server/services/dashboard.service';
import { getTotalExpenses } from '@/server/services/expense.service';
import { getTotalIncome } from '@/server/services/income.service';

/**
 * GET /api/dashboard/summary
 * Returns dashboard summary data: net worth, cashflow YTD, and recent transactions
 * Requires authentication
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch net worth trend, calendar years, and transactions in parallel
    const [netWorthData, calendarYears, recentTransactionsData] =
      await Promise.all([
        getNetWorthTrend(userId),
        getCalendarYears(['FISCAL', 'ANNUAL']),
        prisma.transaction.findMany({
          where: {
            userId,
            status: 'CONFIRMED',
            category: {
              not: 'Transfer',
            },
          },
          include: {
            financialAccount: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
          take: 5,
        }),
      ]);

    // Extract net worth data - use latest values
    const latestTotal = netWorthData.latestNetWorth;
    const latestCashTotal = netWorthData.latestCashTotal;
    const latestStockTotal = netWorthData.latestStockTotal;
    const latestCashDate = netWorthData.latestCashDate;
    const latestStockDate = netWorthData.latestStockDate;

    // Extract sparkline: last 6 data points from netWorthTrend
    const sparklinePoints = netWorthData.dataPoints.slice(-6).map((point) => ({
      date: point.date,
      value: point.netWorthTotal,
    }));

    // Build cashflow YTD - use most recent calendar year if it exists
    let cashflowYTD: DashboardSummaryResponse['cashflowYTD'] = null;

    if (calendarYears.length > 0) {
      // Prefer FISCAL year, fall back to ANNUAL
      const currentCalendarYear =
        calendarYears.find((y) => y.type === 'FISCAL') ??
        calendarYears.find((y) => y.type === 'ANNUAL') ??
        calendarYears[0]!;

      // Fetch income and expenses for the most recent fiscal year in parallel
      const [totalIncome, totalExpenses] = await Promise.all([
        getTotalIncome(currentCalendarYear.id, userId),
        getTotalExpenses(currentCalendarYear.id, userId),
      ]);

      const netCashflow = totalIncome - totalExpenses;
      const savingsRate =
        totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;

      // Clamp savings rate to 0-100
      const clampedSavingsRate = Math.max(0, Math.min(100, savingsRate));

      cashflowYTD = {
        calendarYearId: currentCalendarYear.id,
        calendarYearDescription: currentCalendarYear.description,
        totalIncome,
        totalExpenses,
        netCashflow,
        savingsRate: clampedSavingsRate,
      };
    }

    // Map recent transactions to response format
    const recentTransactions = recentTransactionsData.map((txn) => ({
      id: txn.id,
      date: txn.date.toISOString().split('T')[0] ?? '',
      description: txn.description ?? '',
      amount: Number(txn.amount),
      type: txn.type as 'DEBIT' | 'CREDIT',
      category: txn.category ?? '',
      bankAccountName: txn.financialAccount?.name ?? null,
    }));

    // Fetch monthly trend and top expense categories for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const [monthlyTrend, topExpenseCategories] = await Promise.all([
      getMonthlyIncomeExpenseTrend(userId, 6),
      getTopExpenseCategories(userId, monthStart, monthEnd, 5),
    ]);

    const response: DashboardSummaryResponse = {
      netWorth: {
        latestTotal,
        latestCashTotal,
        latestStockTotal,
        latestCashDate,
        latestStockDate,
        sparklinePoints,
      },
      cashflowYTD,
      recentTransactions,
      monthlyTrend,
      topExpenseCategories,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
