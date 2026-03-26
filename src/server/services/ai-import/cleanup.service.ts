import { prisma } from '@/server/db/client';
import { getStorageAdapter } from './image-storage.adapter';

/**
 * Cleanup Service for Expired Images
 * Handles automatic deletion of images that have passed their TTL
 */

/**
 * Get the TTL in days from environment variables
 * Defaults to 7 days if not specified
 */
function getImageTTLDays(): number {
  const ttlEnv = process.env.AI_IMPORT_IMAGE_TTL_DAYS;
  if (!ttlEnv) return 7; // Default TTL

  const ttl = parseInt(ttlEnv, 10);
  if (isNaN(ttl) || ttl <= 0) {
    console.warn(
      `Invalid AI_IMPORT_IMAGE_TTL_DAYS: "${ttlEnv}". Using default 7 days.`,
    );
    return 7;
  }

  return ttl;
}

/**
 * Calculate expiration date based on current time + TTL
 */
function calculateExpirationDate(ttlDays: number): Date {
  const now = new Date();
  now.setDate(now.getDate() + ttlDays);
  return now;
}

/**
 * Set expiration timestamp on a newly uploaded image
 * Called after image upload to record when it should be deleted
 */
export async function setImageExpiration(imageId: string): Promise<void> {
  try {
    const ttlDays = getImageTTLDays();
    const expiresAt = calculateExpirationDate(ttlDays);

    await prisma.importImage.update({
      where: { id: imageId },
      data: { expiresAt },
    });

    console.log(
      `[Cleanup] Set expiration for image ${imageId} to ${expiresAt.toISOString()} (TTL: ${ttlDays} days)`,
    );
  } catch (error) {
    console.error('[Cleanup] Failed to set image expiration:', error);
    throw error;
  }
}

/**
 * Delete expired images from database and storage
 * Should be called periodically (e.g., by a cron job or scheduled task)
 * Returns count of images deleted
 */
export async function deleteExpiredImages(): Promise<number> {
  try {
    const now = new Date();

    // Find all expired images
    const expiredImages = await prisma.importImage.findMany({
      where: {
        expiresAt: {
          lt: now, // Less than current time
        },
      },
      select: {
        id: true,
        storageUrl: true,
        userId: true,
      },
    });

    if (expiredImages.length === 0) {
      console.log('[Cleanup] No expired images to delete');
      return 0;
    }

    console.log(
      `[Cleanup] Found ${expiredImages.length} expired images. Beginning deletion...`,
    );

    const storage = getStorageAdapter();
    let successCount = 0;
    let failureCount = 0;

    // Delete each image
    for (const image of expiredImages) {
      try {
        // Delete from storage
        await storage.deleteImage(image.storageUrl);

        // Delete from database
        await prisma.importImage.delete({
          where: { id: image.id },
        });

        console.log(`[Cleanup] Deleted expired image ${image.id}`);
        successCount++;
      } catch (error) {
        console.error(
          `[Cleanup] Failed to delete image ${image.id}:`,
          error instanceof Error ? error.message : error,
        );
        failureCount++;
      }
    }

    console.log(
      `[Cleanup] Deletion complete. Success: ${successCount}, Failures: ${failureCount}`,
    );

    return successCount;
  } catch (error) {
    console.error('[Cleanup] deleteExpiredImages failed:', error);
    throw error;
  }
}

/**
 * Get statistics about image expiration
 * Useful for monitoring and debugging
 */
export async function getImageExpirationStats(): Promise<{
  total: number;
  expired: number;
  expiringSoon: number;
  byUser: Record<string, number>;
}> {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const allImages = await prisma.importImage.findMany({
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });

    const expired = allImages.filter((img) => img.expiresAt && img.expiresAt < now);
    const expiringSoon = allImages.filter(
      (img) =>
        img.expiresAt &&
        img.expiresAt >= now &&
        img.expiresAt <= threeDaysFromNow,
    );

    const byUser: Record<string, number> = {};
    allImages.forEach((img) => {
      byUser[img.userId] = (byUser[img.userId] || 0) + 1;
    });

    return {
      total: allImages.length,
      expired: expired.length,
      expiringSoon: expiringSoon.length,
      byUser,
    };
  } catch (error) {
    console.error('[Cleanup] getImageExpirationStats failed:', error);
    throw error;
  }
}
