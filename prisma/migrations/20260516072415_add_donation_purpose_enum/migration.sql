/*
  Warnings:

  - You are about to drop the column `transactionId` on the `IncomeRecord` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DonationPurposeEnum" AS ENUM ('VOLUNTARY', 'INTEREST_CLEANSING');

-- DropForeignKey
ALTER TABLE "IncomeRecord" DROP CONSTRAINT "IncomeRecord_transactionId_fkey";

-- DropIndex
DROP INDEX "IncomeRecord_transactionId_key";

-- AlterTable
ALTER TABLE "DonationPayment" ADD COLUMN     "donationPurpose" "DonationPurposeEnum" NOT NULL DEFAULT 'VOLUNTARY';

-- AlterTable
ALTER TABLE "IncomeRecord" DROP COLUMN "transactionId";
