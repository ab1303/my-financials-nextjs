import { NextResponse } from 'next/server';
import { monthlyIncomeSummaryHandler } from '@/server/controllers/income.controller';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarYearId = searchParams.get('calendarYearId');
    const userId = searchParams.get('userId');

    if (!calendarYearId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    const monthlySummary = await monthlyIncomeSummaryHandler(
      calendarYearId,
      userId,
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
