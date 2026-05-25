-- Enable pg_trgm extension for trigram-based GIN indexes.
-- Safe to run multiple times (IF NOT EXISTS).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on Transaction.description.
-- Makes ILIKE '%pattern%' queries near-instant instead of full sequential scans.
-- Used by: categoryRule findSimilar, runCategoryRules, applyRuleToPast.
CREATE INDEX IF NOT EXISTS "idx_transaction_description_trgm"
  ON "Transaction" USING gin (description gin_trgm_ops);