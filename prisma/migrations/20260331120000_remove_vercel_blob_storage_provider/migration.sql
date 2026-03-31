-- Remove VERCEL_BLOB from StorageProviderEnum
-- First update any rows that use VERCEL_BLOB to LOCAL (safe fallback)
UPDATE "ImportImage" SET "storageProvider" = 'LOCAL' WHERE "storageProvider" = 'VERCEL_BLOB';

-- Recreate the enum without VERCEL_BLOB
CREATE TYPE "StorageProviderEnum_new" AS ENUM ('LOCAL', 'S3');
ALTER TABLE "ImportImage" ALTER COLUMN "storageProvider" TYPE "StorageProviderEnum_new" USING ("storageProvider"::text::"StorageProviderEnum_new");
ALTER TYPE "StorageProviderEnum" RENAME TO "StorageProviderEnum_old";
ALTER TYPE "StorageProviderEnum_new" RENAME TO "StorageProviderEnum";
DROP TYPE "StorageProviderEnum_old";
