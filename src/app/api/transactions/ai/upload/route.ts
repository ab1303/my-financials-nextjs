import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import {
  getStorageAdapter,
  getStorageProviderEnum,
} from '@/server/services/ai-import/image-storage.adapter';
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
 * POST /api/transactions/ai/upload
 *
 * Upload images for AI parsing. Supports multipart/form-data with multiple files.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const bankAccountId = formData.get('bankAccountId') as string | null;

    if (bankAccountId?.trim()) {
      const account = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, userId },
      });

      if (!account) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 },
        );
      }
    }

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

    const storageAdapter = getStorageAdapter();

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

        validateMimeType(mimeType);
        validateFileSize(buffer.length);
        await validateImageDimensions(buffer);

        const storageResult = await storageAdapter.uploadImage(
          buffer,
          mimeType,
          userId,
          file.name,
        );

        const importImage = await prisma.importImage.create({
          data: {
            userId,
            sessionId: '',
            fileName: storageResult.fileName,
            fileSize: storageResult.fileSize,
            mimeType: storageResult.mimeType,
            storageUrl: storageResult.storageUrl,
            storageProvider: getStorageProviderEnum(),
          },
        });

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
      ...(bankAccountId?.trim() ? { bankAccountId } : {}),
    };

    deleteExpiredImages().catch((err) =>
      console.error('[transactions/ai/upload] Background cleanup failed:', err),
    );

    if (errors.length > 0) {
      return NextResponse.json(
        { ...response, warnings: errors },
        { status: 207 },
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[transactions/ai/upload] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
