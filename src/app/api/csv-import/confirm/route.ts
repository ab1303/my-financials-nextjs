import { NextResponse } from 'next/server';

/** @deprecated Moved. Use /api/transactions/csv/ equivalents. */
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been removed. Use /api/transactions/csv/ instead.' },
    { status: 410 },
  );
}
