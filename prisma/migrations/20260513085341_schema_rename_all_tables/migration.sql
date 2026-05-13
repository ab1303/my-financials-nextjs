/*
  Warnings:

  - You are about to drop the column `donationId` on the `DonationPayment` table. All the data in the column will be lost.
  - You are about to drop the column `zakatId` on the `ZakatPayment` table. All the data in the column will be lost.
  - You are about to drop the `AIImportSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BankAssetEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BankAssetSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BankInterest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Donation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Example` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Expense` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExpenseEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Income` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IncomeEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Relationship` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TransactionCategoryOverride` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Zakat` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `donationLedgerId` to the `DonationPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zakatObligationId` to the `ZakatPayment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AIImportSession" DROP CONSTRAINT "AIImportSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "AIUsageLog" DROP CONSTRAINT "AIUsageLog_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "BankAssetEntry" DROP CONSTRAINT "BankAssetEntry_accountId_fkey";

-- DropForeignKey
ALTER TABLE "BankAssetEntry" DROP CONSTRAINT "BankAssetEntry_importImageId_fkey";

-- DropForeignKey
ALTER TABLE "BankAssetEntry" DROP CONSTRAINT "BankAssetEntry_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE "BankAssetSnapshot" DROP CONSTRAINT "BankAssetSnapshot_userId_fkey";

-- DropForeignKey
ALTER TABLE "BankInterest" DROP CONSTRAINT "BankInterest_bankId_fkey";

-- DropForeignKey
ALTER TABLE "BankInterest" DROP CONSTRAINT "BankInterest_calendarId_fkey";

-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_calendarId_fkey";

-- DropForeignKey
ALTER TABLE "DonationPayment" DROP CONSTRAINT "DonationPayment_donationId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_calendarId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_userId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseEntry" DROP CONSTRAINT "ExpenseEntry_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseEntry" DROP CONSTRAINT "ExpenseEntry_expenseId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseEntry" DROP CONSTRAINT "ExpenseEntry_importImageId_fkey";

-- DropForeignKey
ALTER TABLE "ImportImage" DROP CONSTRAINT "ImportImage_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Income" DROP CONSTRAINT "Income_calendarId_fkey";

-- DropForeignKey
ALTER TABLE "Income" DROP CONSTRAINT "Income_userId_fkey";

-- DropForeignKey
ALTER TABLE "IncomeEntry" DROP CONSTRAINT "IncomeEntry_incomeId_fkey";

-- DropForeignKey
ALTER TABLE "Individual" DROP CONSTRAINT "Individual_relationshipId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bankInterestId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_businessId_fkey";

-- DropForeignKey
ALTER TABLE "Relationship" DROP CONSTRAINT "Relationship_userId_fkey";

-- DropForeignKey
ALTER TABLE "StockHolding" DROP CONSTRAINT "StockHolding_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE "StockSnapshot" DROP CONSTRAINT "StockSnapshot_userId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionCategoryOverride" DROP CONSTRAINT "TransactionCategoryOverride_userId_fkey";

-- DropForeignKey
ALTER TABLE "Zakat" DROP CONSTRAINT "Zakat_calendarId_fkey";

-- DropForeignKey
ALTER TABLE "ZakatPayment" DROP CONSTRAINT "ZakatPayment_zakatId_fkey";

-- AlterTable
ALTER TABLE "DonationPayment" DROP COLUMN "donationId",
ADD COLUMN     "donationLedgerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ZakatPayment" DROP COLUMN "zakatId",
ADD COLUMN     "zakatObligationId" TEXT NOT NULL;

-- DropTable
DROP TABLE "AIImportSession";

-- DropTable
DROP TABLE "BankAssetEntry";

-- DropTable
DROP TABLE "BankAssetSnapshot";

-- DropTable
DROP TABLE "BankInterest";

-- DropTable
DROP TABLE "Donation";

-- DropTable
DROP TABLE "Example";

-- DropTable
DROP TABLE "Expense";

-- DropTable
DROP TABLE "ExpenseEntry";

-- DropTable
DROP TABLE "Income";

-- DropTable
DROP TABLE "IncomeEntry";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "Relationship";

-- DropTable
DROP TABLE "StockSnapshot";

-- DropTable
DROP TABLE "TransactionCategoryOverride";

-- DropTable
DROP TABLE "Zakat";

-- CreateTable
CREATE TABLE "RelationshipType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelationshipType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankInterestPayment" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "businessId" TEXT,
    "bankInterestLiabilityId" TEXT,

    CONSTRAINT "BankInterestPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankInterestLiability" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amountDue" MONEY NOT NULL,
    "bankId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,

    CONSTRAINT "BankInterestLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZakatObligation" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "amountDue" MONEY NOT NULL,

    CONSTRAINT "ZakatObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationLedger" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,

    CONSTRAINT "DonationLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeLedger" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL,
    "dateEarned" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "source" "IncomeSourceEnumType" NOT NULL,
    "incomeLedgerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseLedger" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyExpenseSummary" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" MONEY NOT NULL,
    "categoryId" TEXT NOT NULL,
    "expenseLedgerId" TEXT NOT NULL,
    "importImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyExpenseSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBalanceRecord" (
    "id" TEXT NOT NULL,
    "balance" MONEY NOT NULL,
    "accountId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "importImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBalanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importType" "ImportTypeEnum" NOT NULL,
    "status" "ImportStatusEnum" NOT NULL DEFAULT 'PENDING',
    "overallConfidence" DOUBLE PRECISION,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantCategoryMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantCategoryMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipType_name_userId_key" ON "RelationshipType"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ZakatObligation_calendarId_key" ON "ZakatObligation"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationLedger_calendarId_key" ON "DonationLedger"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeLedger_calendarId_userId_key" ON "IncomeLedger"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "IncomeRecord_incomeLedgerId_dateEarned_idx" ON "IncomeRecord"("incomeLedgerId", "dateEarned");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseLedger_calendarId_userId_key" ON "ExpenseLedger"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "MonthlyExpenseSummary_expenseLedgerId_month_idx" ON "MonthlyExpenseSummary"("expenseLedgerId", "month");

-- CreateIndex
CREATE INDEX "BankBalanceSnapshot_userId_snapshotDate_idx" ON "BankBalanceSnapshot"("userId", "snapshotDate");

-- CreateIndex
CREATE INDEX "BankBalanceRecord_snapshotId_idx" ON "BankBalanceRecord"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "BankBalanceRecord_accountId_snapshotId_key" ON "BankBalanceRecord"("accountId", "snapshotId");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_snapshotDate_idx" ON "PortfolioSnapshot"("userId", "snapshotDate");

-- CreateIndex
CREATE INDEX "ImportSession_userId_createdAt_idx" ON "ImportSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantCategoryMap_userId_idx" ON "MerchantCategoryMap"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCategoryMap_userId_description_key" ON "MerchantCategoryMap"("userId", "description");

-- AddForeignKey
ALTER TABLE "RelationshipType" ADD CONSTRAINT "RelationshipType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Individual" ADD CONSTRAINT "Individual_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "RelationshipType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankInterestPayment" ADD CONSTRAINT "BankInterestPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankInterestPayment" ADD CONSTRAINT "BankInterestPayment_bankInterestLiabilityId_fkey" FOREIGN KEY ("bankInterestLiabilityId") REFERENCES "BankInterestLiability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankInterestLiability" ADD CONSTRAINT "BankInterestLiability_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankInterestLiability" ADD CONSTRAINT "BankInterestLiability_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatObligation" ADD CONSTRAINT "ZakatObligation_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_zakatObligationId_fkey" FOREIGN KEY ("zakatObligationId") REFERENCES "ZakatObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationLedger" ADD CONSTRAINT "DonationLedger_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_donationLedgerId_fkey" FOREIGN KEY ("donationLedgerId") REFERENCES "DonationLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeLedger" ADD CONSTRAINT "IncomeLedger_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeLedger" ADD CONSTRAINT "IncomeLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_incomeLedgerId_fkey" FOREIGN KEY ("incomeLedgerId") REFERENCES "IncomeLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLedger" ADD CONSTRAINT "ExpenseLedger_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLedger" ADD CONSTRAINT "ExpenseLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyExpenseSummary" ADD CONSTRAINT "MonthlyExpenseSummary_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyExpenseSummary" ADD CONSTRAINT "MonthlyExpenseSummary_expenseLedgerId_fkey" FOREIGN KEY ("expenseLedgerId") REFERENCES "ExpenseLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyExpenseSummary" ADD CONSTRAINT "MonthlyExpenseSummary_importImageId_fkey" FOREIGN KEY ("importImageId") REFERENCES "ImportImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceSnapshot" ADD CONSTRAINT "BankBalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceRecord" ADD CONSTRAINT "BankBalanceRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceRecord" ADD CONSTRAINT "BankBalanceRecord_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "BankBalanceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceRecord" ADD CONSTRAINT "BankBalanceRecord_importImageId_fkey" FOREIGN KEY ("importImageId") REFERENCES "ImportImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHolding" ADD CONSTRAINT "StockHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImage" ADD CONSTRAINT "ImportImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCategoryMap" ADD CONSTRAINT "MerchantCategoryMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
