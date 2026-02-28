-- CreateEnum
CREATE TYPE "public"."InvestmentTermEnumType" AS ENUM ('SHORT_TERM', 'MID_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "public"."CurrencyEnumType" AS ENUM ('AUD', 'USD');

-- AlterEnum
ALTER TYPE "public"."BusinessEnumType" ADD VALUE 'BROKERAGE';

-- CreateTable
CREATE TABLE "public"."StockSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockHolding" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "buyPrice" MONEY NOT NULL,
    "buyDate" TIMESTAMP(3) NOT NULL,
    "currentPrice" MONEY NOT NULL,
    "currency" "public"."CurrencyEnumType" NOT NULL,
    "plannedTerm" "public"."InvestmentTermEnumType" NOT NULL,
    "salePrice" MONEY,
    "saleDate" TIMESTAMP(3),
    "soldQuantity" DECIMAL(65,30),
    "accountId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockSnapshot_userId_snapshotDate_idx" ON "public"."StockSnapshot"("userId", "snapshotDate");

-- CreateIndex
CREATE INDEX "StockHolding_snapshotId_idx" ON "public"."StockHolding"("snapshotId");

-- CreateIndex
CREATE INDEX "StockHolding_accountId_idx" ON "public"."StockHolding"("accountId");

-- CreateIndex
CREATE INDEX "StockHolding_ticker_idx" ON "public"."StockHolding"("ticker");

-- AddForeignKey
ALTER TABLE "public"."StockSnapshot" ADD CONSTRAINT "StockSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockHolding" ADD CONSTRAINT "StockHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockHolding" ADD CONSTRAINT "StockHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."StockSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
