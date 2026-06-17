-- Create the tax category enum
CREATE TYPE "TaxCategoryEnumType" AS ENUM ('DEDUCTIBLE', 'NON_DEDUCTIBLE');

-- Bring Business in line with the current schema
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "isDgrRegistered" BOOLEAN DEFAULT false;

-- Convert the existing donation snapshot column to the enum type
ALTER TABLE "DonationPayment"
  ALTER COLUMN "taxCategory" TYPE "TaxCategoryEnumType"
  USING ("taxCategory"::text::"TaxCategoryEnumType");

-- Add Zakat tax snapshots without applying to the database yet
ALTER TABLE "ZakatPayment"
  ADD COLUMN IF NOT EXISTS "taxCategory" "TaxCategoryEnumType";

UPDATE "ZakatPayment" zp
SET "taxCategory" = CASE
  WHEN zp."beneficiaryType" = 'BUSINESS' AND b."isDgrRegistered" = true THEN 'DEDUCTIBLE'::"TaxCategoryEnumType"
  ELSE 'NON_DEDUCTIBLE'::"TaxCategoryEnumType"
END
FROM "Business" b
WHERE zp."businessId" = b."id"
  AND zp."taxCategory" IS NULL;

UPDATE "ZakatPayment"
SET "taxCategory" = 'NON_DEDUCTIBLE'::"TaxCategoryEnumType"
WHERE "taxCategory" IS NULL;

ALTER TABLE "ZakatPayment"
  ALTER COLUMN "taxCategory" SET NOT NULL;

-- Preserve the reporting index used by the ledger queries
CREATE INDEX IF NOT EXISTS "Transaction_userId_date_id_idx" ON "Transaction"("userId", "date", "id");
