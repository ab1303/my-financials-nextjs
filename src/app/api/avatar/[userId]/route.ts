import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getStorageAdapter } from '@/server/services/ai-import/image-storage.adapter';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { userId } = await params;

  if (!session || session.user.id !== userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarStorageUrl: true },
  });

  if (!user?.avatarStorageUrl) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const adapter = getStorageAdapter();
    const buffer = await adapter.getImageBuffer(user.avatarStorageUrl);

    const ext = user.avatarStorageUrl.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const contentType = contentTypeMap[ext ?? ''] ?? 'image/jpeg';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
