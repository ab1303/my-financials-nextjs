-- ============================================================================
-- Fix Mistaken EXCLUDED Transactions
-- ============================================================================
-- This script promotes transactions with real categories that are mistakenly
-- EXCLUDED back to CONFIRMED status.
--
-- BACKGROUND:
-- Due to a bug in the transaction reclassification logic, CREDIT transactions
-- classified from "Transfer" to real categories remained EXCLUDED instead of
-- being promoted to CONFIRMED.
--
-- HOW TO USE THIS SCRIPT SAFELY:
--   1. Run STEP 1a (individual details) — review every transaction that will
--      be promoted. If any looks wrong, exclude its id in the WHERE clauses
--      of STEP 2 and STEP 3 before proceeding.
--   2. Run STEP 1b (counts) — quick sanity check on the totals.
--   3. If satisfied, run STEP 2 then STEP 3.
--   4. Run STEP 4 to verify all affected rows are now gone from EXCLUDED.
--   5. In the app: Expenses tab shows promoted DEBITs; Income tab shows CREDITs.
--
-- Run this script in pgAdmin to fix all affected records.
-- ============================================================================

-- ============================================================================
-- STEP 1a: AUDIT — Review every transaction that will be promoted
--           Run this FIRST and inspect each row before running the UPDATEs.
-- ============================================================================

SELECT
  id,
  date::date        AS date,
  type,
  category,
  amount::numeric   AS amount,
  LEFT(description, 60) AS description
FROM "Transaction"
WHERE
  status = 'EXCLUDED'
  AND (
    (type = 'CREDIT' AND category NOT IN ('Transfer', 'Excluded', 'Reimbursement'))
    OR
    (type = 'DEBIT'  AND category != 'Transfer')
  )
ORDER BY type, date DESC;

-- ============================================================================
-- STEP 1b: COUNT BEFORE (quick sanity check — no modifications)
-- ============================================================================

SELECT
  'CREDIT with real category' AS check_type,
  COUNT(*) AS count,
  'BEFORE' AS stage
FROM "Transaction"
WHERE
  type = 'CREDIT'
  AND status = 'EXCLUDED'
  AND category NOT IN ('Transfer', 'Excluded', 'Reimbursement')
UNION ALL
SELECT
  'DEBIT with real category' AS check_type,
  COUNT(*) AS count,
  'BEFORE' AS stage
FROM "Transaction"
WHERE
  type = 'DEBIT'
  AND status = 'EXCLUDED'
  AND category != 'Transfer';

-- ============================================================================
-- STEP 2: Promote CREDIT transactions → CONFIRMED
--         Only run after reviewing STEP 1a output above.
-- ============================================================================

UPDATE "Transaction"
SET
  status = 'CONFIRMED',
  "confirmedAt" = NOW(),
  "updatedAt" = NOW()
WHERE
  type = 'CREDIT'
  AND status = 'EXCLUDED'
  AND category NOT IN ('Transfer', 'Excluded', 'Reimbursement');

-- ============================================================================
-- STEP 3: Promote DEBIT transactions → CONFIRMED
--         Only run after reviewing STEP 1a output above.
-- ============================================================================

UPDATE "Transaction"
SET
  status = 'CONFIRMED',
  "confirmedAt" = NOW(),
  "updatedAt" = NOW()
WHERE
  type = 'DEBIT'
  AND status = 'EXCLUDED'
  AND category != 'Transfer';

-- ============================================================================
-- STEP 4: Verify AFTER (should return all zeros — no EXCLUDED rows with
--         real categories should remain after STEP 2 + STEP 3)
-- ============================================================================

SELECT 
  'CREDIT with real category' as check_type,
  COUNT(*) as count,
  'AFTER' as stage
FROM "Transaction"
WHERE 
  type = 'CREDIT'
  AND status = 'EXCLUDED'
  AND category NOT IN ('Transfer', 'Excluded', 'Reimbursement')
UNION ALL
SELECT 
  'DEBIT with real category' as check_type,
  COUNT(*) as count,
  'AFTER' as stage
FROM "Transaction"
WHERE 
  type = 'DEBIT'
  AND status = 'EXCLUDED'
  AND category != 'Transfer';

-- ============================================================================
-- END OF SCRIPT
-- If the AFTER counts show all zeros, the fix was successful!
-- In the app:
--   • Go to Cashflow → Transactions
--   • "Expenses" tab: promoted DEBIT transactions now appear here
--   • "Income" tab:   promoted CREDIT transactions now appear here
-- ============================================================================
