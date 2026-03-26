import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getStorageAdapter } from '@/server/services/ai-import/image-storage.adapter';
import {
  setImageExpiration,
  deleteExpiredImages,
} from '@/server/services/ai-import/cleanup.service';
import {
  validateMimeType,
  validateFileSize,
  validateImageDimensions,
  MAX_IMAGES_PER_SESSION,
} from '@/server/services/ai-import/validation';
import type { UploadResponse } from '@/server/services/ai-import/_types';

/**
 * POST /api/ai-import/upload
 *
 * Upload images for AI parsing. Supports multipart/form-data with multiple files.
 *
 * Request:
 *   multipart/form-data with files
 *
 * Response:
 *   {
 *     imageIds: string[],
 *     images: Array<{ imageId, fileName, fileSize, mimeType }>
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > MAX_IMAGES_PER_SESSION) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_IMAGES_PER_SESSION} images per upload session`,
        },
        { status: 400 },
      );
    }

    // Get storage adapter
    const storageAdapter = getStorageAdapter();

    // Process each file
    const uploadedImages: Array<{
      id: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      storageUrl: string;
    }> = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const mimeType = file.type;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Validate file
        validateMimeType(mimeType);
        validateFileSize(buffer.length);
        await validateImageDimensions(buffer);

        // Upload to storage
        const storageResult = await storageAdapter.uploadImage(
          buffer,
          mimeType,
          userId,
          file.name,
        );

        // Save metadata to database
        const importImage = await prisma.importImage.create({
          data: {
            userId,
            sessionId: '', // Will be set during parse
            fileName: storageResult.fileName,
            fileSize: storageResult.fileSize,
            mimeType: storageResult.mimeType,
            storageUrl: storageResult.storageUrl,
            storageProvider: 'LOCAL', // Determined by adapter
          },
        });

        // Set expiration timestamp (TTL)
        await setImageExpiration(importImage.id);

        uploadedImages.push({
          id: importImage.id,
          fileName: storageResult.fileName,
          fileSize: storageResult.fileSize,
          mimeType: storageResult.mimeType,
          storageUrl: storageResult.storageUrl,
        });
      } catch (error) {
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // If some files failed but others succeeded, return partial success
    if (uploadedImages.length === 0) {
      return NextResponse.json(
        {
          error: 'All files failed to upload',
          details: errors,
        },
        { status: 400 },
      );
    }

    const response: UploadResponse = {
      imageIds: uploadedImages.map((img) => img.id),
      images: uploadedImages.map((img) => ({
        imageId: img.id,
        fileName: img.fileName,
        fileSize: img.fileSize,
        mimeType: img.mimeType,
      })),
    };

    // Fire-and-forget cleanup of expired images — no cron needed.
    // Runs asynchronously on each upload so expired files are eventually removed.
    deleteExpiredImages().catch((err) =>
      console.error('[ai-import/upload] Background cleanup failed:', err),
    );

    if (errors.length > 0) {
      return NextResponse.json(
        { ...response, warnings: errors },
        {
          status: 207, // Multi-status: partial success
        },
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[ai-import/upload] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
