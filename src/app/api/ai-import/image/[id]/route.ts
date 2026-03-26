import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getStorageAdapter } from '@/server/services/ai-import/image-storage.adapter';

/**
 * GET /api/ai-import/image/[id]
 *
 * Secure proxy for accessing uploaded images.
 * - Verifies user authentication
 * - Checks image ownership (prevents IDOR)
 * - Verifies image hasn't expired (TTL check)
 * - Streams image buffer with proper headers
 *
 * Response: Image file with Content-Type header
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Await params (Next.js 15+ pattern)
    const { id: imageId } = await params;

    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch image from database
    const image = await prisma.importImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Verify ownership (IDOR protection)
    if (image.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if image has expired
    if (image.expiresAt && new Date() > image.expiresAt) {
      return NextResponse.json(
        {
          error: 'Image has expired',
          expiredAt: image.expiresAt.toISOString(),
        },
        { status: 410 }, // 410 Gone
      );
    }

    // Get storage adapter and retrieve image
    const storage = getStorageAdapter();
    const imageBuffer = await storage.getImageBuffer(image.storageUrl);

    // Return image with proper headers
    // Set Cache-Control to prevent caching (sensitive data)
    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        // Prevent framing in other sites
        'X-Frame-Options': 'DENY',
      },
    });
  } catch (error) {
    console.error('[ai-import/image/[id]] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
