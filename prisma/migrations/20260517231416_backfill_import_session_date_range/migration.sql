-- Backfill startDate / endDate for existing ImportSession rows that already have transactions.
-- Safe to re-run: the WHERE clause skips rows already populated.
UPDATE "ImportSession" s
SET    "startDate" = sub.min_date,
       "endDate"   = sub.max_date
FROM (
  SELECT "importSessionId",
         MIN("date") AS min_date,
         MAX("date") AS max_date
  FROM   "Transaction"
  WHERE  "importSessionId" IS NOT NULL
  GROUP  BY "importSessionId"
) sub
WHERE s.id = sub."importSessionId"
  AND s."startDate" IS NULL;
