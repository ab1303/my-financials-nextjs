-- DropForeignKey
ALTER TABLE "BankAccount" DROP CONSTRAINT "BankAccount_bankId_fkey";

-- DropForeignKey
ALTER TABLE "BankAccount" DROP CONSTRAINT "BankAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "BankBalanceRecord" DROP CONSTRAINT "BankBalanceRecord_accountId_fkey";

-- DropForeignKey
ALTER TABLE "StockHolding" DROP CONSTRAINT "StockHolding_accountId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "TransferMatchRule" DROP CONSTRAINT "TransferMatchRule_creditBankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "TransferMatchRule" DROP CONSTRAINT "TransferMatchRule_debitBankAccountId_fkey";

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

-- CreateIndex
CREATE INDEX "FinancialAccount_userId_institutionId_idx" ON "FinancialAccount"("userId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_name_institutionId_userId_key" ON "FinancialAccount"("name", "institutionId", "userId");

-- DataMigration: Copy all BankAccount rows into FinancialAccount (preserving IDs; bankId → institutionId)
INSERT INTO "FinancialAccount" (id, name, "institutionId", "userId", "createdAt", "updatedAt")
SELECT id, name, "bankId", "userId", "createdAt", "updatedAt"
FROM "BankAccount";

-- DataMigration: Create a "Default Account" FinancialAccount for each BROKERAGE Business that has StockHoldings
INSERT INTO "FinancialAccount" (id, name, "institutionId", "userId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Default Account', b.id, b."userId", NOW(), NOW()
FROM "Business" b
WHERE b.type = 'BROKERAGE'
  AND EXISTS (SELECT 1 FROM "StockHolding" sh WHERE sh."accountId" = b.id)
ON CONFLICT DO NOTHING;

-- DataMigration: Retarget StockHolding.accountId from Business.id → FinancialAccount.id
UPDATE "StockHolding" sh
SET "accountId" = fa.id
FROM "FinancialAccount" fa
JOIN "Business" b ON fa."institutionId" = b.id
WHERE sh."accountId" = b.id
  AND fa.name = 'Default Account';

-- DropTable (safe now — all referencing FKs were dropped above; data copied into FinancialAccount)
DROP TABLE "BankAccount";

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceRecord" ADD CONSTRAINT "BankBalanceRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHolding" ADD CONSTRAINT "StockHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_debitBankAccountId_fkey" FOREIGN KEY ("debitBankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_creditBankAccountId_fkey" FOREIGN KEY ("creditBankAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
