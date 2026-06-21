import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import type {
  CashflowAnalyticsData,
  CashflowKPIs,
  MonthlyTrendPoint,
} from '@/server/models/cashflow-analytics';
import type { MonthlyIncomeSummary } from '@/server/models/income';
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

    const parseSelectionParam = (paramName: string) => {
      if (!searchParams.has(paramName)) return undefined;
      const rawValue = searchParams.get(paramName);
      if (rawValue === null || rawValue.trim() === '') return null;
      const values = rawValue.split(',').filter((id) => id.trim());
      return values.length > 0 ? values : null;
    };

    // Parse filter parameters (comma-separated list of IDs)
    const incomeCategoryIds = parseSelectionParam('incomeCategoryIds');

    const expenseCategoryIds = parseSelectionParam('expenseCategoryIds');

    // Backwards compatibility with older group-based params
    const incomeGroupIdsParam = searchParams.get('incomeGroupIds');
    const incomeGroupIds = incomeGroupIdsParam
      ? incomeGroupIdsParam.split(',').filter((id) => id.trim())
      : undefined;

    const expenseGroupIdsParam = searchParams.get('expenseGroupIds');
    const expenseGroupIds = expenseGroupIdsParam
      ? expenseGroupIdsParam.split(',').filter((id) => id.trim())
      : undefined;

    // Fetch calendar year for expense month→year resolution
    const calendarYear = await prisma.calendarYear.findUnique({
      where: { id: calendarYearId },
      select: { fromYear: true, fromMonth: true, toYear: true },
    });

    const selectedExpenseCategoryIds = expenseCategoryIds;

    const selectedIncomeCategoryIds = incomeCategoryIds;

    // Build expense category member IDs from selected expense groups (legacy)
    let resolvedExpenseCategoryIds: string[] | null | undefined =
      selectedExpenseCategoryIds;
    if (
      resolvedExpenseCategoryIds === undefined &&
      expenseGroupIds &&
      expenseGroupIds.length > 0
    ) {
      const groups = await prisma.categoryGroup.findMany({
        where: {
          id: { in: expenseGroupIds },
          userId,
          scope: 'EXPENSE',
        },
        include: {
          expenseCategories: {
            select: { expenseCategoryId: true },
          },
        },
      });
      resolvedExpenseCategoryIds = groups.flatMap((g) =>
        g.expenseCategories.map((ec) => ec.expenseCategoryId),
      );
    }

    // Build income source member IDs from selected income groups (legacy)
    let resolvedIncomeSourceIds: string[] | null | undefined =
      selectedIncomeCategoryIds;
    if (
      resolvedIncomeSourceIds === undefined &&
      incomeGroupIds &&
      incomeGroupIds.length > 0
    ) {
      const groups = await prisma.categoryGroup.findMany({
        where: {
          id: { in: incomeGroupIds },
          userId,
          scope: 'INCOME',
        },
        include: {
          incomeSources: {
            select: { incomeSourceId: true },
          },
        },
      });
      resolvedIncomeSourceIds = groups.flatMap((g) =>
        g.incomeSources.map((s) => s.incomeSourceId),
      );
    }

    const emptyMonthlyIncome: MonthlyIncomeSummary[] = Array.from(
      { length: 12 },
      (_, index) => {
        const month = index + 1;
        const year =
          calendarYear && month < calendarYear.fromMonth
            ? calendarYear.toYear
            : calendarYear?.fromYear ?? new Date().getFullYear();

        return {
          month,
          year,
          totalAmount: 0,
          entryCount: 0,
        };
      },
    );

    const emptyMonthlyExpenseSummaries = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      totalAmount: 0,
      entryCount: 0,
    }));

    const [
      totalIncome,
      totalExpenses,
      monthlyIncome,
      monthlyExpenses,
      expenseCategories,
      incomeSources,
    ] = await Promise.all([
      resolvedIncomeSourceIds === null
        ? Promise.resolve(0)
        : getTotalIncome(
            calendarYearId,
            userId,
            undefined,
            bankAccountId,
            resolvedIncomeSourceIds,
          ),
      resolvedExpenseCategoryIds === null
        ? Promise.resolve(0)
        : getTotalExpenses(
            calendarYearId,
            userId,
            bankAccountId,
            resolvedExpenseCategoryIds,
          ),
      resolvedIncomeSourceIds === null
        ? Promise.resolve(emptyMonthlyIncome)
        : getMonthlyIncomeSummaryFiltered(
            calendarYearId,
            userId,
            bankAccountId,
            resolvedIncomeSourceIds,
          ),
      resolvedExpenseCategoryIds === null
        ? Promise.resolve(emptyMonthlyExpenseSummaries)
        : getMonthlyExpenseSummaries(
            calendarYearId,
            userId,
            bankAccountId,
            resolvedExpenseCategoryIds,
          ),
      resolvedExpenseCategoryIds === null
        ? Promise.resolve([])
        : getExpenseCategoryBreakdownForYear(
            calendarYearId,
            userId,
            bankAccountId,
            resolvedExpenseCategoryIds,
          ),
      resolvedIncomeSourceIds === null
        ? Promise.resolve([])
        : getIncomeSourceBreakdownForYear(
            calendarYearId,
            userId,
            bankAccountId,
            resolvedIncomeSourceIds,
          ),
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
