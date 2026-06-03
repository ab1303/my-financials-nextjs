-- Migration: remove-income-record-tables
-- Transaction is now the single source of truth for income (type=CREDIT).
-- IncomeRecord and IncomeLedger are deprecated materialized-projection tables being dropped.

-- Step 1: Migrate any manual IncomeRecord rows (no transactionId) to Transaction table
INSERT INTO "Transaction" (
  id, "userId", type, source, status, date, amount, category, description,
  "bankAccountId", "importSessionId", "confirmedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  il."userId",
  'CREDIT',
  'USER_MANUAL',
  'CONFIRMED',
  ir."dateEarned",
  ir.amount,
  COALESCE(isco.name, 'Income'),
  CONCAT('Manual income: ', COALESCE(isco.name, 'Income')),
  NULL,
  NULL,
  NOW(),
  ir."createdAt",
  ir."updatedAt"
FROM "IncomeRecord" ir
JOIN "IncomeLedger" il ON ir."incomeLedgerId" = il.id
LEFT JOIN "IncomeSource" isco ON ir."incomeSourceId" = isco.id
WHERE ir."transactionId" IS NULL;

-- Step 2: Drop IncomeRecord foreign key on Transaction (if exists)
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_incomeRecord_fkey";

-- Step 3: Drop indexes
DROP INDEX IF EXISTS "IncomeRecord_transactionId_key";
DROP INDEX IF EXISTS "IncomeRecord_incomeLedgerId_dateEarned_idx";
DROP INDEX IF EXISTS "IncomeLedger_calendarId_userId_key";

-- Step 4: Drop tables (cascade to handle any remaining FKs)
DROP TABLE IF EXISTS "IncomeRecord";
DROP TABLE IF EXISTS "IncomeLedger";

-- Step 5: Remove incomeRecords relation from IncomeSource (no DB change needed — just Prisma model cleanup)
-- IncomeSource table itself is kept as the vocabulary/lookup table for income categories.
