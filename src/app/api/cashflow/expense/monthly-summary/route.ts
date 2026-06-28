import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import {
  getMonthlyExpenseSummaries,
  getTotalExpenses,
} from '@/server/services/expense.service';

function parseSelectionParam(searchParams: URLSearchParams, paramName: string) {
  if (!searchParams.has(paramName)) return undefined;

  const rawValue = searchParams.get(paramName);
  if (rawValue === null) return undefined;
  if (rawValue.trim() === '') return null;

  const values = rawValue.split(',').filter((id) => id.trim());
  return values.length > 0 ? values : null;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const calendarYearId = searchParams.get('calendarYearId');

    if (!calendarYearId) {
      return NextResponse.json(
        { error: 'Missing calendarYearId parameter' },
        { status: 400 },
      );
    }

    const bankAccountId = searchParams.get('bankAccountId') || undefined;
    const expenseCategoryIds = parseSelectionParam(
      searchParams,
      'expenseCategoryIds',
    );

    if (expenseCategoryIds === null) {
      return NextResponse.json({
        monthlySummaries: Array.from({ length: 12 }, (_, index) => ({
          month: index + 1,
          totalAmount: 0,
          entryCount: 0,
        })),
        totalAmount: 0,
      });
    }

    const [monthlySummaries, totalAmount] = await Promise.all([
      getMonthlyExpenseSummaries(
        calendarYearId,
        session.user.id,
        bankAccountId,
        expenseCategoryIds,
      ),
      getTotalExpenses(
        calendarYearId,
        session.user.id,
        bankAccountId,
        expenseCategoryIds,
      ),
    ]);

    return NextResponse.json({
      monthlySummaries,
      totalAmount,
    });
  } catch (error) {
    console.error('Expense monthly summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly expense summaries' },
      { status: 500 },
    );
  }
}
