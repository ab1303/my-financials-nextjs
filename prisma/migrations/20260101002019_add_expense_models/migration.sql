-- CreateTable
CREATE TABLE "public"."ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Expense" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExpenseEntry" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" MONEY NOT NULL,
    "categoryId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "public"."ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_calendarId_userId_key" ON "public"."Expense"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "ExpenseEntry_expenseId_month_idx" ON "public"."ExpenseEntry"("expenseId", "month");

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "public"."CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
