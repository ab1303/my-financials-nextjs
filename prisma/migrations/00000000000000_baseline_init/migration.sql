-- ============================================================
-- BASELINE migration: full schema snapshot as of 2026-05-24.
-- Replaces all prior fragmented db-push changes.
-- Marked as --applied; NOT re-executed against live DB.
-- ============================================================
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleEnumType" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "BusinessEnumType" AS ENUM ('BANK', 'PHILANTHROPY', 'BROKERAGE');

-- CreateEnum
CREATE TYPE "BeneficiaryEnumType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "DonationPurposeEnum" AS ENUM ('VOLUNTARY', 'INTEREST_CLEANSING', 'ZAKAT');

-- CreateEnum
CREATE TYPE "CalendarEnumType" AS ENUM ('ZAKAT', 'ANNUAL', 'FISCAL');

-- CreateEnum
CREATE TYPE "InvestmentTermEnumType" AS ENUM ('SHORT_TERM', 'MID_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "CurrencyEnumType" AS ENUM ('AUD', 'USD');

-- CreateEnum
CREATE TYPE "ImportTypeEnum" AS ENUM ('EXPENSE', 'BANK_ASSET', 'STOCK');

-- CreateEnum
CREATE TYPE "ImportStatusEnum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'VOIDED');

-- CreateEnum
CREATE TYPE "StorageProviderEnum" AS ENUM ('LOCAL', 'S3');

-- CreateEnum
CREATE TYPE "TransactionTypeEnum" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "TransactionSourceEnum" AS ENUM ('LLM_CLASSIFIED', 'USER_OVERRIDE');

-- CreateEnum
CREATE TYPE "TransactionStatusEnum" AS ENUM ('PENDING', 'CONFIRMED', 'EXCLUDED', 'VOIDED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT NOT NULL,
    "role" "RoleEnumType" DEFAULT 'user',
    "phone" TEXT,
    "bio" TEXT,
    "timezone" TEXT DEFAULT 'Australia/Sydney',
    "linkedInUrl" TEXT,
    "preferredCurrency" "CurrencyEnumType" DEFAULT 'AUD',
    "fiscalYearType" "CalendarEnumType" DEFAULT 'FISCAL',
    "avatarStorageUrl" TEXT,
    "avatarStorageProvider" "StorageProviderEnum",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Individual" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "relationshipId" TEXT,
    "addressLine" TEXT,
    "streetAddress" TEXT,
    "suburb" TEXT,
    "postcode" INTEGER,
    "state" TEXT,
    "addressFormat" TEXT DEFAULT 'AU',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Individual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "streetAddress" TEXT,
    "suburb" TEXT,
    "postcode" INTEGER,
    "state" TEXT,
    "type" "BusinessEnumType",
    "userId" TEXT,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZakatObligation" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "amountDue" MONEY NOT NULL,

    CONSTRAINT "ZakatObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZakatPayment" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "beneficiaryType" "BeneficiaryEnumType" NOT NULL,
    "businessId" TEXT,
    "individualId" TEXT,
    "zakatObligationId" TEXT NOT NULL,
    "transactionId" TEXT,

    CONSTRAINT "ZakatPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationLedger" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,

    CONSTRAINT "DonationLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationPayment" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "beneficiaryType" "BeneficiaryEnumType" NOT NULL,
    "taxCategory" TEXT NOT NULL,
    "businessId" TEXT,
    "individualId" TEXT,
    "donationLedgerId" TEXT NOT NULL,
    "transactionId" TEXT,
    "donationPurpose" "DonationPurposeEnum" NOT NULL DEFAULT 'VOLUNTARY',

    CONSTRAINT "DonationPayment_pkey" PRIMARY KEY ("id")
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
    "incomeSourceId" TEXT NOT NULL,
    "incomeLedgerId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEditable" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "CalendarYear" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fromYear" INTEGER NOT NULL,
    "fromMonth" INTEGER NOT NULL,
    "toYear" INTEGER NOT NULL,
    "toMonth" INTEGER NOT NULL,
    "type" "CalendarEnumType",
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
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
    "usdToAudRate" DECIMAL(65,30),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageCashBalance" (
    "id" TEXT NOT NULL,
    "amount" MONEY NOT NULL,
    "currency" "CurrencyEnumType" NOT NULL,
    "accountId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerageCashBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockHolding" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "buyPrice" MONEY NOT NULL,
    "buyDate" TIMESTAMP(3),
    "currentPrice" MONEY NOT NULL,
    "currency" "CurrencyEnumType" NOT NULL,
    "plannedTerm" "InvestmentTermEnumType" NOT NULL,
    "salePrice" MONEY,
    "saleDate" TIMESTAMP(3),
    "soldQuantity" DECIMAL(65,30),
    "accountId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockHolding_pkey" PRIMARY KEY ("id")
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
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storageProvider" "StorageProviderEnum" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageId" TEXT,
    "importType" "ImportTypeEnum" NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCostUSD" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" MONEY NOT NULL,
    "type" "TransactionTypeEnum" NOT NULL,
    "category" TEXT NOT NULL,
    "offsetCategory" TEXT,
    "offsetTransactionId" TEXT,
    "source" "TransactionSourceEnum" NOT NULL,
    "status" "TransactionStatusEnum" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "bankAccountId" TEXT,
    "userId" TEXT NOT NULL,
    "importSessionId" TEXT,
    "transferLinkedTransactionId" TEXT,
    "preLinkCategory" TEXT,
    "preLinkStatus" "TransactionStatusEnum",
    "preVoidStatus" "TransactionStatusEnum",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferMatchRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "amountExact" MONEY,
    "amountMin" MONEY,
    "amountMax" MONEY,
    "debitKeywords" TEXT[],
    "creditKeywords" TEXT[],
    "maxDayGap" INTEGER NOT NULL DEFAULT 5,
    "debitBankAccountId" TEXT,
    "creditBankAccountId" TEXT,
    "confidenceThreshold" INTEGER NOT NULL DEFAULT 85,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferMatchRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferMatchJobResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "ruleId" TEXT,
    "autoLinkedCount" INTEGER NOT NULL DEFAULT 0,
    "flaggedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferMatchJobResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeSource_name_key" ON "IncomeSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipType_name_userId_key" ON "RelationshipType"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Individual_name_userId_key" ON "Individual"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ZakatObligation_calendarId_key" ON "ZakatObligation"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "ZakatPayment_transactionId_key" ON "ZakatPayment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationLedger_calendarId_key" ON "DonationLedger"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationPayment_transactionId_key" ON "DonationPayment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeLedger_calendarId_userId_key" ON "IncomeLedger"("calendarId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeRecord_transactionId_key" ON "IncomeRecord"("transactionId");

-- CreateIndex
CREATE INDEX "IncomeRecord_incomeLedgerId_dateEarned_idx" ON "IncomeRecord"("incomeLedgerId", "dateEarned");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialCategory_name_key" ON "SpecialCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseLedger_calendarId_userId_key" ON "ExpenseLedger"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "MonthlyExpenseSummary_expenseLedgerId_month_idx" ON "MonthlyExpenseSummary"("expenseLedgerId", "month");

-- CreateIndex
CREATE INDEX "FinancialAccount_userId_institutionId_idx" ON "FinancialAccount"("userId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_name_institutionId_userId_key" ON "FinancialAccount"("name", "institutionId", "userId");

-- CreateIndex
CREATE INDEX "BankBalanceSnapshot_userId_snapshotDate_idx" ON "BankBalanceSnapshot"("userId", "snapshotDate");

-- CreateIndex
CREATE INDEX "BankBalanceRecord_snapshotId_idx" ON "BankBalanceRecord"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "BankBalanceRecord_accountId_snapshotId_key" ON "BankBalanceRecord"("accountId", "snapshotId");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_snapshotDate_idx" ON "PortfolioSnapshot"("userId", "snapshotDate");

-- CreateIndex
CREATE INDEX "BrokerageCashBalance_snapshotId_idx" ON "BrokerageCashBalance"("snapshotId");

-- CreateIndex
CREATE INDEX "BrokerageCashBalance_accountId_idx" ON "BrokerageCashBalance"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageCashBalance_accountId_currency_snapshotId_key" ON "BrokerageCashBalance"("accountId", "currency", "snapshotId");

-- CreateIndex
CREATE INDEX "StockHolding_snapshotId_idx" ON "StockHolding"("snapshotId");

-- CreateIndex
CREATE INDEX "StockHolding_accountId_idx" ON "StockHolding"("accountId");

-- CreateIndex
CREATE INDEX "StockHolding_ticker_idx" ON "StockHolding"("ticker");

-- CreateIndex
CREATE INDEX "ImportSession_userId_createdAt_idx" ON "ImportSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportImage_sessionId_idx" ON "ImportImage"("sessionId");

-- CreateIndex
CREATE INDEX "ImportImage_userId_idx" ON "ImportImage"("userId");

-- CreateIndex
CREATE INDEX "AIUsageLog_userId_createdAt_idx" ON "AIUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_userId_importType_createdAt_idx" ON "AIUsageLog"("userId", "importType", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_importType_createdAt_idx" ON "AIUsageLog"("importType", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_sessionId_idx" ON "AIUsageLog"("sessionId");

-- CreateIndex
CREATE INDEX "MerchantCategoryMap_userId_idx" ON "MerchantCategoryMap"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCategoryMap_userId_description_key" ON "MerchantCategoryMap"("userId", "description");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transferLinkedTransactionId_key" ON "Transaction"("transferLinkedTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_userId_bankAccountId_date_idx" ON "Transaction"("userId", "bankAccountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_status_idx" ON "Transaction"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "Transaction_importSessionId_idx" ON "Transaction"("importSessionId");

-- CreateIndex
CREATE INDEX "TransferMatchRule_userId_isActive_idx" ON "TransferMatchRule"("userId", "isActive");

-- CreateIndex
CREATE INDEX "TransferMatchJobResult_userId_importSessionId_idx" ON "TransferMatchJobResult"("userId", "importSessionId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipType" ADD CONSTRAINT "RelationshipType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Individual" ADD CONSTRAINT "Individual_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "RelationshipType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Individual" ADD CONSTRAINT "Individual_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatObligation" ADD CONSTRAINT "ZakatObligation_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_zakatObligationId_fkey" FOREIGN KEY ("zakatObligationId") REFERENCES "ZakatObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationLedger" ADD CONSTRAINT "DonationLedger_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_donationLedgerId_fkey" FOREIGN KEY ("donationLedgerId") REFERENCES "DonationLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeLedger" ADD CONSTRAINT "IncomeLedger_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeLedger" ADD CONSTRAINT "IncomeLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_incomeSourceId_fkey" FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_incomeLedgerId_fkey" FOREIGN KEY ("incomeLedgerId") REFERENCES "IncomeLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceSnapshot" ADD CONSTRAINT "BankBalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceRecord" ADD CONSTRAINT "BankBalanceRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceRecord" ADD CONSTRAINT "BankBalanceRecord_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "BankBalanceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceRecord" ADD CONSTRAINT "BankBalanceRecord_importImageId_fkey" FOREIGN KEY ("importImageId") REFERENCES "ImportImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageCashBalance" ADD CONSTRAINT "BrokerageCashBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageCashBalance" ADD CONSTRAINT "BrokerageCashBalance_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHolding" ADD CONSTRAINT "StockHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHolding" ADD CONSTRAINT "StockHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImage" ADD CONSTRAINT "ImportImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImage" ADD CONSTRAINT "ImportImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCategoryMap" ADD CONSTRAINT "MerchantCategoryMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_offsetTransactionId_fkey" FOREIGN KEY ("offsetTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferLinkedTransactionId_fkey" FOREIGN KEY ("transferLinkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_debitBankAccountId_fkey" FOREIGN KEY ("debitBankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_creditBankAccountId_fkey" FOREIGN KEY ("creditBankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchJobResult" ADD CONSTRAINT "TransferMatchJobResult_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchJobResult" ADD CONSTRAINT "TransferMatchJobResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransferMatchRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;


