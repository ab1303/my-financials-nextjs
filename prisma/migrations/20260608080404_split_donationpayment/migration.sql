/*
  Warnings:

  - You are about to alter the column `balance` on the `BankBalanceRecord` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `BrokerageCashBalance` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `DonationPayment` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(19,4)`.
  - You are about to alter the column `amountApplied` on the `DonationPaymentEvidence` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `MonthlyExpenseSummary` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `buyPrice` on the `StockHolding` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `currentPrice` on the `StockHolding` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `salePrice` on the `StockHolding` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `runningBalance` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amountExact` on the `TransferMatchRule` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amountMin` on the `TransferMatchRule` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amountMax` on the `TransferMatchRule` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amountDue` on the `ZakatObligation` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `ZakatPayment` table. The data in that column could be lost. The data in that column will be cast from `Money` to `Decimal(12,2)`.

*/
-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "BankBalanceRecord" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "BrokerageCashBalance" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "DonationPayment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(19,4);

-- AlterTable
ALTER TABLE "DonationPaymentEvidence" ALTER COLUMN "amountApplied" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "MonthlyExpenseSummary" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "StockHolding" ALTER COLUMN "buyPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "currentPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "salePrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "runningBalance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "TransferMatchRule" ALTER COLUMN "amountExact" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "amountMin" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "amountMax" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ZakatObligation" ALTER COLUMN "amountDue" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ZakatPayment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "MigrationAudit" (
    "id" TEXT NOT NULL,
    "legacyTable" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "newTable" TEXT NOT NULL,
    "newId" TEXT,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigrationAudit_legacyTable_legacyId_idx" ON "MigrationAudit"("legacyTable", "legacyId");
