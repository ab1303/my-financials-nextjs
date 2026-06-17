-- CreateEnum
CREATE TYPE "TransferOrphanResolution" AS ENUM ('EXCLUDED', 'EXPENSE', 'INCOME');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "orphanResolution" "TransferOrphanResolution";

-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN "isTracked" BOOLEAN NOT NULL DEFAULT true;
