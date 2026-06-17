/*
  Warnings:

  - You are about to drop the column `amountLinked` on the `DonationPaymentEvidence` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `DonationPaymentEvidence` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[donationPaymentId,evidenceTransactionId]` on the table `DonationPaymentEvidence` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amountApplied` to the `DonationPaymentEvidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `evidenceTransactionId` to the `DonationPaymentEvidence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DonationPaymentEvidence` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DonationPaymentEvidence" DROP CONSTRAINT "DonationPaymentEvidence_donationPaymentId_fkey";

-- DropForeignKey
ALTER TABLE "DonationPaymentEvidence" DROP CONSTRAINT "DonationPaymentEvidence_transactionId_fkey";

-- DropIndex
DROP INDEX "DonationPaymentEvidence_donationPaymentId_transactionId_key";

-- DropIndex
DROP INDEX "DonationPaymentEvidence_transactionId_idx";

-- AlterTable
ALTER TABLE "DonationPaymentEvidence" DROP COLUMN "amountLinked",
DROP COLUMN "transactionId",
ADD COLUMN     "amountApplied" MONEY NOT NULL,
ADD COLUMN     "confidence" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "evidenceTransactionId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "DonationPaymentEvidence_evidenceTransactionId_idx" ON "DonationPaymentEvidence"("evidenceTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationPaymentEvidence_donationPaymentId_evidenceTransacti_key" ON "DonationPaymentEvidence"("donationPaymentId", "evidenceTransactionId");

-- AddForeignKey
ALTER TABLE "DonationPaymentEvidence" ADD CONSTRAINT "DonationPaymentEvidence_donationPaymentId_fkey" FOREIGN KEY ("donationPaymentId") REFERENCES "DonationPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPaymentEvidence" ADD CONSTRAINT "DonationPaymentEvidence_evidenceTransactionId_fkey" FOREIGN KEY ("evidenceTransactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
