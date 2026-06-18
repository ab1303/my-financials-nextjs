-- CreateEnum
CREATE TYPE "CategoryGroupScope" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "CategoryGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "CategoryGroupScope" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryGroupExpenseCategory" (
    "id" TEXT NOT NULL,
    "categoryGroupId" TEXT NOT NULL,
    "expenseCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryGroupExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryGroupIncomeSource" (
    "id" TEXT NOT NULL,
    "categoryGroupId" TEXT NOT NULL,
    "incomeSourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryGroupIncomeSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryGroup_userId_scope_createdAt_idx" ON "CategoryGroup"("userId", "scope", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryGroup_userId_scope_name_key" ON "CategoryGroup"("userId", "scope", "name");

-- CreateIndex
CREATE INDEX "CategoryGroupExpenseCategory_categoryGroupId_createdAt_idx" ON "CategoryGroupExpenseCategory"("categoryGroupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryGroupExpenseCategory_categoryGroupId_expenseCategor_key" ON "CategoryGroupExpenseCategory"("categoryGroupId", "expenseCategoryId");

-- CreateIndex
CREATE INDEX "CategoryGroupIncomeSource_categoryGroupId_createdAt_idx" ON "CategoryGroupIncomeSource"("categoryGroupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryGroupIncomeSource_categoryGroupId_incomeSourceId_key" ON "CategoryGroupIncomeSource"("categoryGroupId", "incomeSourceId");

-- AddForeignKey
ALTER TABLE "CategoryGroup" ADD CONSTRAINT "CategoryGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryGroupExpenseCategory" ADD CONSTRAINT "CategoryGroupExpenseCategory_categoryGroupId_fkey" FOREIGN KEY ("categoryGroupId") REFERENCES "CategoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryGroupExpenseCategory" ADD CONSTRAINT "CategoryGroupExpenseCategory_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryGroupIncomeSource" ADD CONSTRAINT "CategoryGroupIncomeSource_categoryGroupId_fkey" FOREIGN KEY ("categoryGroupId") REFERENCES "CategoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryGroupIncomeSource" ADD CONSTRAINT "CategoryGroupIncomeSource_incomeSourceId_fkey" FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
