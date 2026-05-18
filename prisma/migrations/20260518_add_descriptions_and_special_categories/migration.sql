-- Add description field to IncomeSource
ALTER TABLE "IncomeSource" ADD COLUMN "description" TEXT;

-- Add description field to ExpenseCategory
ALTER TABLE "ExpenseCategory" ADD COLUMN "description" TEXT;

-- Create SpecialCategory table
CREATE TABLE "SpecialCategory" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "isEditable" BOOLEAN NOT NULL DEFAULT false,
  "color"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpecialCategory_name_key" ON "SpecialCategory"("name");

-- Seed SpecialCategory with Transfer, Excluded, Reimbursement, Pending
INSERT INTO "SpecialCategory" ("id", "name", "description", "isActive", "isEditable", "color", "createdAt") VALUES
  (gen_random_uuid()::text, 'Transfer', 'Money moved between your own bank accounts or internal allocations', true, false, 'blue', now()),
  (gen_random_uuid()::text, 'Excluded', 'Transactions marked as outside scope (e.g., fees to ignore, test entries)', true, false, 'gray', now()),
  (gen_random_uuid()::text, 'Reimbursement', 'Transactions awaiting reimbursement or manual reconciliation', true, true, 'amber', now()),
  (gen_random_uuid()::text, 'Pending', 'Unconfirmed transactions awaiting categorization', true, false, 'orange', now());

-- Seed IncomeSource with descriptions for existing sources
UPDATE "IncomeSource" SET "description" = 'Income from employment or salary' WHERE "name" = 'Employment';
UPDATE "IncomeSource" SET "description" = 'Income from stock dividends or capital gains' WHERE "name" = 'Stocks';
UPDATE "IncomeSource" SET "description" = 'Income from bond interest or fixed income investments' WHERE "name" = 'Bonds';
UPDATE "IncomeSource" SET "description" = 'Income from rental property or real estate' WHERE "name" = 'Rental';
UPDATE "IncomeSource" SET "description" = 'Income from business operations or self-employment' WHERE "name" = 'Business';
UPDATE "IncomeSource" SET "description" = 'Income from freelance work or contract services' WHERE "name" = 'Freelance';
UPDATE "IncomeSource" SET "description" = 'Income from dividend distributions' WHERE "name" = 'Dividend';
UPDATE "IncomeSource" SET "description" = 'Income from other sources not listed above' WHERE "name" = 'Other';
