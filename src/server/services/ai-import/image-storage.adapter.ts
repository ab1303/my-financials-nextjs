import fs from 'fs';
import path from 'path';
import { mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    pathPrefix?: string,
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
  async uploadImage(
    file: Buffer,
    mimeType: string,
    userId: string,
    originalFileName: string,
    pathPrefix = 'ai-imports',
  ): Promise<StorageResult> {
    const uploadDir = path.join(process.cwd(), 'uploads', pathPrefix);

    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    // Generate secure filename: [userId]/[uuid].[ext]
    const ext = this.getExtensionFromMimeType(mimeType);
    const fileName = `${randomUUID()}.${ext}`;
    const userDir = path.join(uploadDir, userId);
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
 * AWS S3 Storage adapter for production
 * Requires AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */
export class S3StorageAdapter implements IImageStorageAdapter {
  private bucket: string;
  private region: string;
  private client: S3Client;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || '';
    this.region = process.env.AWS_S3_REGION || '';

    if (!this.bucket || !this.region) {
      throw new Error(
        'AWS_S3_BUCKET and AWS_S3_REGION environment variables are required for S3StorageAdapter',
      );
    }

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async uploadImage(
    file: Buffer,
    mimeType: string,
    userId: string,
    originalFileName: string,
    pathPrefix = 'ai-imports',
  ): Promise<StorageResult> {
    const ext = this.getExtensionFromMimeType(mimeType);
    const key = `${pathPrefix}/${userId}/${randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType,
        // Private by default — no ACL set; relies on bucket policy blocking public access
      }),
    );

    return {
      // Store the S3 key (not a URL) so the secure proxy handles retrieval
      storageUrl: key,
      fileName: originalFileName,
      fileSize: file.length,
      mimeType,
    };
  }

  async deleteImage(storageUrl: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageUrl,
        }),
      );
    } catch (error) {
      console.warn(`Failed to delete S3 object: ${storageUrl}`, error);
    }
  }

  async getImageBuffer(storageUrl: string): Promise<Buffer> {
    // Use a short-lived pre-signed URL (60s) to fetch the object securely
    const signedUrl = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageUrl }),
      { expiresIn: 60 },
    );

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch S3 object: ${storageUrl} (${response.status})`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/heic': 'heic',
    };
    return mimeToExt[mimeType] ?? 'bin';
  }
}

/**
 * Factory function to get the appropriate storage adapter based on environment
 */
export function getStorageAdapter(): IImageStorageAdapter {
  const provider = process.env.IMAGE_STORAGE_PROVIDER || 'local';

  switch (provider.toLowerCase()) {
    case 's3':
      return new S3StorageAdapter();
    case 'local':
    default:
      return new LocalStorageAdapter();
  }
}

/**
 * Returns the Prisma StorageProviderEnum value matching the current env config.
 */
export function getStorageProviderEnum(): 'LOCAL' | 'S3' {
  const provider = process.env.IMAGE_STORAGE_PROVIDER || 'local';
  switch (provider.toLowerCase()) {
    case 's3':
      return 'S3';
    case 'local':
    default:
      return 'LOCAL';
  }
}
