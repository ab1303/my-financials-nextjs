import { NextResponse } from 'next/server';

/** @deprecated Moved. Use /api/transactions/ai/ equivalents. */
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been removed. Use /api/transactions/ai/ instead.' },
    { status: 410 },
  );
}
