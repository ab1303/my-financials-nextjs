-- CreateEnum
CREATE TYPE "public"."IncomeSourceEnumType" AS ENUM ('EMPLOYMENT', 'STOCKS', 'BONDS', 'RENTAL', 'BUSINESS', 'FREELANCE', 'OTHER');

-- CreateTable
CREATE TABLE "public"."Income" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IncomeEntry" (
    "id" TEXT NOT NULL,
    "dateEarned" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "source" "public"."IncomeSourceEnumType" NOT NULL,
    "incomeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Income_calendarId_userId_key" ON "public"."Income"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "IncomeEntry_incomeId_dateEarned_idx" ON "public"."IncomeEntry"("incomeId", "dateEarned");

-- AddForeignKey
ALTER TABLE "public"."Income" ADD CONSTRAINT "Income_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "public"."CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncomeEntry" ADD CONSTRAINT "IncomeEntry_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "public"."Income"("id") ON DELETE CASCADE ON UPDATE CASCADE;
