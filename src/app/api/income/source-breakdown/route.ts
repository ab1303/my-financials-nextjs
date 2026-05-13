import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { sourceBreakdownHandler } from '@/server/controllers/income.controller';

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
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');

    if (!calendarYearId || !monthStr || !yearStr) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month or year' },
        { status: 400 },
      );
    }

    const sourceBreakdown = await sourceBreakdownHandler(
      calendarYearId,
      month,
      year,
      session.user.id,
    );
    return NextResponse.json(sourceBreakdown);
  } catch (error) {
    console.error('Error fetching source breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch source breakdown' },
      { status: 500 },
    );
  }
}
