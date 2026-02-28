-- CreateEnum
CREATE TYPE "public"."ImportTypeEnum" AS ENUM ('EXPENSE', 'BANK_ASSET');

-- CreateEnum
CREATE TYPE "public"."ImportStatusEnum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."StorageProviderEnum" AS ENUM ('LOCAL', 'VERCEL_BLOB', 'S3');

-- AlterTable
ALTER TABLE "public"."BankAssetEntry" ADD COLUMN     "importImageId" TEXT;

-- AlterTable
ALTER TABLE "public"."ExpenseEntry" ADD COLUMN     "importImageId" TEXT;

-- CreateTable
CREATE TABLE "public"."AIImportSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importType" "public"."ImportTypeEnum" NOT NULL,
    "status" "public"."ImportStatusEnum" NOT NULL DEFAULT 'PENDING',
    "overallConfidence" DOUBLE PRECISION,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storageProvider" "public"."StorageProviderEnum" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIImportSession_userId_createdAt_idx" ON "public"."AIImportSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportImage_sessionId_idx" ON "public"."ImportImage"("sessionId");

-- CreateIndex
CREATE INDEX "ImportImage_userId_idx" ON "public"."ImportImage"("userId");

-- AddForeignKey
ALTER TABLE "public"."ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_importImageId_fkey" FOREIGN KEY ("importImageId") REFERENCES "public"."ImportImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAssetEntry" ADD CONSTRAINT "BankAssetEntry_importImageId_fkey" FOREIGN KEY ("importImageId") REFERENCES "public"."ImportImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIImportSession" ADD CONSTRAINT "AIImportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportImage" ADD CONSTRAINT "ImportImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportImage" ADD CONSTRAINT "ImportImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AIImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
