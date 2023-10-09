/*
  Warnings:

  - You are about to drop the `Bank` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BusinessEnumType" AS ENUM ('BANK', 'PHILANTHROPY');

-- DropTable
DROP TABLE "Bank";

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "streetAddress" TEXT,
    "suburb" TEXT,
    "postcode" INTEGER,
    "state" TEXT,
    "type" "BusinessEnumType",

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "businessId" TEXT,
    "bankInterestId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankInterest" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amountDue" MONEY NOT NULL,
    "amountPaid" MONEY NOT NULL,
    "bankId" TEXT NOT NULL,

    CONSTRAINT "BankInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_businessId_key" ON "Payment"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BankInterest_bankId_key" ON "BankInterest"("bankId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankInterestId_fkey" FOREIGN KEY ("bankInterestId") REFERENCES "BankInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankInterest" ADD CONSTRAINT "BankInterest_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
