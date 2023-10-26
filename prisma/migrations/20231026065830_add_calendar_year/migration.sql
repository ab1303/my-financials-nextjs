/*
  Warnings:

  - You are about to drop the column `amountPaid` on the `BankInterest` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[calendarId]` on the table `BankInterest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `calendarId` to the `BankInterest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BeneficiaryEnumType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CalendarEnumType" AS ENUM ('ZAKAT', 'ANNUAL', 'FISCAL');

-- AlterTable
ALTER TABLE "BankInterest" DROP COLUMN "amountPaid",
ADD COLUMN     "calendarId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Individual" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "relationship" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Individual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarYear" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fromYear" INTEGER NOT NULL,
    "fromMonth" INTEGER NOT NULL,
    "toYear" INTEGER NOT NULL,
    "toMonth" INTEGER NOT NULL,
    "type" "CalendarEnumType",

    CONSTRAINT "CalendarYear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankInterest_calendarId_key" ON "BankInterest"("calendarId");

-- AddForeignKey
ALTER TABLE "Individual" ADD CONSTRAINT "Individual_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankInterest" ADD CONSTRAINT "BankInterest_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
