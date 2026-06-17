import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import type {
  CashflowAnalyticsData,
  CashflowKPIs,
  MonthlyTrendPoint,
} from '@/server/models/cashflow-analytics';
import {
  getExpenseCategoryBreakdownForYear,
  getMonthlyExpenseSummaries,
  getTotalExpenses,
} from '@/server/services/expense.service';
import {
  getIncomeSourceBreakdownForYear,
  getMonthlyIncomeSummaryFiltered,
  getTotalIncome,
} from '@/server/services/income.service';
import { prisma } from '@/server/db/client';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const calendarYearId = searchParams.get('calendarYearId');
    if (!calendarYearId) {
      return NextResponse.json(
        { error: 'Missing calendarYearId parameter' },
        { status: 400 },
      );
    }

    const bankAccountIdParam = searchParams.get('bankAccountId');
    const bankAccountId = bankAccountIdParam ? bankAccountIdParam : undefined;

    // Fetch calendar year for expense month→year resolution
    const calendarYear = await prisma.calendarYear.findUnique({
      where: { id: calendarYearId },
      select: { fromYear: true, fromMonth: true, toYear: true },
    });

    const [
      totalIncome,
      totalExpenses,
      monthlyIncome,
      monthlyExpenses,
      expenseCategories,
      incomeSources,
    ] = await Promise.all([
      getTotalIncome(calendarYearId, userId, undefined, bankAccountId),
      getTotalExpenses(calendarYearId, userId, bankAccountId),
      getMonthlyIncomeSummaryFiltered(calendarYearId, userId, bankAccountId),
      getMonthlyExpenseSummaries(calendarYearId, userId, bankAccountId),
      getExpenseCategoryBreakdownForYear(calendarYearId, userId, bankAccountId),
      getIncomeSourceBreakdownForYear(calendarYearId, userId, bankAccountId),
    ]);

    // Helper: determine calendar year for an expense month
    const getYearForExpenseMonth = (month: number): number => {
      if (!calendarYear) return new Date().getFullYear();
      return month >= calendarYear.fromMonth
        ? calendarYear.fromYear
        : calendarYear.toYear;
    };

    // Build monthly trend map from income data (has year)
    const monthlyTrendMap = new Map<string, MonthlyTrendPoint>();

    for (const income of monthlyIncome) {
      const key = `${income.year}-${income.month}`;
      monthlyTrendMap.set(key, {
        month: income.month,
        year: income.year,
        label: new Date(income.year, income.month - 1, 1).toLocaleString(
          'en-AU',
          { month: 'short', year: '2-digit' },
        ),
        income: income.totalAmount,
        expenses: 0,
        net: income.totalAmount,
      });
    }

    // Merge expense data using proper year derivation
    for (const expense of monthlyExpenses) {
      if (expense.totalAmount === 0) continue;
      const year = getYearForExpenseMonth(expense.month);
      const key = `${year}-${expense.month}`;
      const existing = monthlyTrendMap.get(key);
      if (existing) {
        existing.expenses = expense.totalAmount;
        existing.net = existing.income - existing.expenses;
      } else {
        monthlyTrendMap.set(key, {
          month: expense.month,
          year,
          label: new Date(year, expense.month - 1, 1).toLocaleString('en-AU', {
            month: 'short',
            year: '2-digit',
          }),
          income: 0,
          expenses: expense.totalAmount,
          net: -expense.totalAmount,
        });
      }
    }

    const monthlyTrend = Array.from(monthlyTrendMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    const netCashflow = totalIncome - totalExpenses;
    const savingsRate =
      totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;
    const monthsWithIncome = monthlyIncome.filter(
      (m) => m.totalAmount > 0,
    ).length;
    const monthsWithExpenses = monthlyExpenses.filter(
      (m) => m.totalAmount > 0,
    ).length;
    const avgMonthlyIncome =
      monthsWithIncome > 0 ? totalIncome / monthsWithIncome : 0;
    const avgMonthlyExpenses =
      monthsWithExpenses > 0 ? totalExpenses / monthsWithExpenses : 0;

    const kpis: CashflowKPIs = {
      totalIncome,
      totalExpenses,
      netCashflow,
      savingsRate,
      avgMonthlyIncome,
      avgMonthlyExpenses,
    };

    const response: CashflowAnalyticsData = {
      kpis,
      monthlyTrend,
      expenseCategories,
      incomeSources,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching cashflow analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cashflow analytics' },
      { status: 500 },
    );
  }
}
