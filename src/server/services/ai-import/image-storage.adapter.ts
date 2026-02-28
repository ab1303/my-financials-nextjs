import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';

/**
 * Storage adapter interface for image uploads
 * Allows pluggable backends: local filesystem, Vercel Blob, AWS S3, etc.
 */
export interface IImageStorageAdapter {
  uploadImage(
    file: Buffer,
    mimeType: string,
    userId: string,
    originalFileName: string,
  ): Promise<StorageResult>;

  deleteImage(storageUrl: string): Promise<void>;

  getImageBuffer(storageUrl: string): Promise<Buffer>;
}

export interface StorageResult {
  storageUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Local filesystem storage adapter for development
 * Stores files in /uploads/ai-imports/ directory (gitignored)
 */
export class LocalStorageAdapter implements IImageStorageAdapter {
  private uploadDir: string;

  constructor() {
    // Store in project root /uploads/ai-imports/
    this.uploadDir = path.join(process.cwd(), 'uploads', 'ai-imports');
  }

  async uploadImage(
    file: Buffer,
    mimeType: string,
    userId: string,
    originalFileName: string,
  ): Promise<StorageResult> {
    // Ensure directory exists
    await mkdir(this.uploadDir, { recursive: true });

    // Generate secure filename: [userId]/[uuid].[ext]
    const ext = this.getExtensionFromMimeType(mimeType);
    const fileName = `${randomUUID()}.${ext}`;
    const userDir = path.join(this.uploadDir, userId);
    await mkdir(userDir, { recursive: true });
    const filePath = path.join(userDir, fileName);

    // Write file to disk
    await fs.promises.writeFile(filePath, file);

    // Return relative path as storage URL for local storage
    const relativePath = path.relative(process.cwd(), filePath);

    return {
      storageUrl: relativePath,
      fileName: originalFileName,
      fileSize: file.length,
      mimeType,
    };
  }

  async deleteImage(storageUrl: string): Promise<void> {
    try {
      const filePath = path.join(process.cwd(), storageUrl);
      await fs.promises.unlink(filePath);
    } catch (error) {
      // Silently fail if file doesn't exist
      console.warn(`Failed to delete file: ${storageUrl}`, error);
    }
  }

  async getImageBuffer(storageUrl: string): Promise<Buffer> {
    const filePath = path.join(process.cwd(), storageUrl);
    return fs.promises.readFile(filePath);
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    return mimeToExt[mimeType] || 'bin';
  }
}

/**
 * Vercel Blob Storage adapter for production
 * Requires VERCEL_BLOB_TOKEN environment variable
 */
export class VercelBlobStorageAdapter implements IImageStorageAdapter {
  private token: string;

  constructor() {
    this.token = process.env.VERCEL_BLOB_TOKEN || '';
    if (!this.token) {
      throw new Error(
        'VERCEL_BLOB_TOKEN environment variable is not set. Cannot initialize VercelBlobStorageAdapter.',
      );
    }
  }

  async uploadImage(
    file: Buffer,
    mimeType: string,
    userId: string,
    originalFileName: string,
  ): Promise<StorageResult> {
    const { put } = await import('@vercel/blob');

    const fileName = `${randomUUID()}-${originalFileName}`;
    const blobPath = `ai-imports/${userId}/${fileName}`;

    const blob = await put(blobPath, file, {
      access: 'private',
      contentType: mimeType,
    });

    return {
      storageUrl: blob.url,
      fileName: originalFileName,
      fileSize: file.length,
      mimeType,
    };
  }

  async deleteImage(storageUrl: string): Promise<void> {
    const { del } = await import('@vercel/blob');
    try {
      await del(storageUrl);
    } catch (error) {
      console.warn(`Failed to delete blob: ${storageUrl}`, error);
    }
  }

  async getImageBuffer(storageUrl: string): Promise<Buffer> {
    const response = await fetch(storageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from blob storage: ${storageUrl}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

/**
 * AWS S3 Storage adapter for production (alternative to Vercel Blob)
 * Requires AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */
export class S3StorageAdapter implements IImageStorageAdapter {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || '';
    this.region = process.env.AWS_S3_REGION || '';

    if (!this.bucket || !this.region) {
      throw new Error(
        'AWS_S3_BUCKET and AWS_S3_REGION environment variables are required for S3StorageAdapter',
      );
    }
  }

  async uploadImage(
    file: Buffer,
    mimeType: string,
    userId: string,
    originalFileName: string,
  ): Promise<StorageResult> {
    // Implementation for S3 would use AWS SDK
    // This is a placeholder for Phase 6
    throw new Error(
      'S3StorageAdapter not implemented yet. Use LocalStorageAdapter or VercelBlobStorageAdapter instead.',
    );
  }

  async deleteImage(_storageUrl: string): Promise<void> {
    throw new Error('S3StorageAdapter not implemented yet');
  }

  async getImageBuffer(_storageUrl: string): Promise<Buffer> {
    throw new Error('S3StorageAdapter not implemented yet');
  }
}

/**
 * Factory function to get the appropriate storage adapter based on environment
 */
export function getStorageAdapter(): IImageStorageAdapter {
  const provider = process.env.IMAGE_STORAGE_PROVIDER || 'local';

  switch (provider.toLowerCase()) {
    case 'vercel-blob':
      return new VercelBlobStorageAdapter();
    case 's3':
      return new S3StorageAdapter();
    case 'local':
    default:
      return new LocalStorageAdapter();
  }
}
