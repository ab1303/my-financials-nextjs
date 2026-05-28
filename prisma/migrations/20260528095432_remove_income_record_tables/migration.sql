-- Migration: remove-income-record-tables
-- Transaction is now the single source of truth for income (type=CREDIT).
-- IncomeRecord and IncomeLedger are deprecated materialized-projection tables being dropped.
--
-- NOTE: Manual IncomeRecord entries are NOT migrated to Transaction here.
-- Reason: they may duplicate already-imported CSV transactions, causing false inflation.
-- Users should re-enter any genuinely manual-only income through the new income form.

-- Step 1: Drop IncomeRecord foreign key on Transaction (if exists)
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_incomeRecord_fkey";

-- Step 2: Drop indexes
DROP INDEX IF EXISTS "IncomeRecord_transactionId_key";
DROP INDEX IF EXISTS "IncomeRecord_incomeLedgerId_dateEarned_idx";
DROP INDEX IF EXISTS "IncomeLedger_calendarId_userId_key";

-- Step 3: Drop tables (cascade to handle any remaining FKs)
DROP TABLE IF EXISTS "IncomeRecord";
DROP TABLE IF EXISTS "IncomeLedger";

-- Step 4: Remove incomeRecords relation from IncomeSource (no DB change needed — just Prisma model cleanup)
-- IncomeSource table itself is kept as the vocabulary/lookup table for income categories.
