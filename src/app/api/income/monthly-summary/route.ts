import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { monthlyIncomeSummaryHandler } from '@/server/controllers/income.controller';

export async function GET(request: Request) {
  try {
    // Get userId from authenticated session (security fix)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const calendarYearId = searchParams.get('calendarYearId');

    if (!calendarYearId) {
      return NextResponse.json(
        { error: 'Missing calendarYearId parameter' },
        { status: 400 },
      );
    }

    const monthlySummary = await monthlyIncomeSummaryHandler(
      calendarYearId,
      session.user.id,
    );
    return NextResponse.json(monthlySummary);
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly summary' },
      { status: 500 },
    );
  }
}
