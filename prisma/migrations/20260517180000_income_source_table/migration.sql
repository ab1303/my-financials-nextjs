-- CreateTable: IncomeSource
CREATE TABLE "IncomeSource" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex on name
CREATE UNIQUE INDEX "IncomeSource_name_key" ON "IncomeSource"("name");

-- Seed default income sources (Title Case names matching existing enum display labels)
INSERT INTO "IncomeSource" ("id", "name", "isActive", "createdAt") VALUES
    (gen_random_uuid()::text, 'Employment', true, now()),
    (gen_random_uuid()::text, 'Stocks',     true, now()),
    (gen_random_uuid()::text, 'Bonds',      true, now()),
    (gen_random_uuid()::text, 'Rental',     true, now()),
    (gen_random_uuid()::text, 'Business',   true, now()),
    (gen_random_uuid()::text, 'Freelance',  true, now()),
    (gen_random_uuid()::text, 'Dividend',   true, now()),
    (gen_random_uuid()::text, 'Other',      true, now());

-- Add nullable FK column to IncomeRecord
ALTER TABLE "IncomeRecord" ADD COLUMN "incomeSourceId" TEXT;

-- Backfill incomeSourceId: match UPPER(IncomeSource.name) against the old enum value string
UPDATE "IncomeRecord" ir
SET "incomeSourceId" = is2."id"
FROM "IncomeSource" is2
WHERE UPPER(is2."name") = ir."source"::text;

-- Fallback: any unmatched rows get the 'Other' source
UPDATE "IncomeRecord"
SET "incomeSourceId" = (SELECT "id" FROM "IncomeSource" WHERE "name" = 'Other' LIMIT 1)
WHERE "incomeSourceId" IS NULL;

-- Make incomeSourceId NOT NULL
ALTER TABLE "IncomeRecord" ALTER COLUMN "incomeSourceId" SET NOT NULL;

-- Add FK constraint
ALTER TABLE "IncomeRecord"
    ADD CONSTRAINT "IncomeRecord_incomeSourceId_fkey"
    FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old enum column
ALTER TABLE "IncomeRecord" DROP COLUMN "source";

-- Drop enum type
DROP TYPE "IncomeSourceEnumType";
