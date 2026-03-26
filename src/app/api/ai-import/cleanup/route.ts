/**
 * GET /api/ai-import/cleanup
 *
 * Cron endpoint that deletes expired import images.
 * Invoked automatically by Vercel Cron (vercel.json) — do NOT call from the client.
 *
 * The CRON_SECRET header is required to prevent unauthorized invocations.
 * Set CRON_SECRET in your Vercel Project Environment Variables.
 *
 * For local/non-Vercel deployments the upload route triggers the same cleanup
 * as a fire-and-forget background task on every upload.
 */
import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredImages } from '@/server/services/ai-import/cleanup.service';

export async function GET(request: NextRequest) {
  // Validate the secret to prevent unauthorised invocations
  const secret = request.headers.get('x-cron-secret');

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deletedCount = await deleteExpiredImages();

    return NextResponse.json(
      {
        success: true,
        deletedCount,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[api/ai-import/cleanup] Cron job failed:', error);
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
