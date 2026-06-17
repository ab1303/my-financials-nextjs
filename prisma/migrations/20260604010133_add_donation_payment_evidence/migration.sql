/*
  Warnings:

  - You are about to drop the column `transactionId` on the `DonationPayment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[interestTxId]` on the table `DonationPayment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "DonationPayment" DROP CONSTRAINT "DonationPayment_transactionId_fkey";

-- DropIndex
DROP INDEX "DonationPayment_transactionId_key";

-- AlterTable
ALTER TABLE "DonationPayment" DROP COLUMN "transactionId",
ADD COLUMN     "interestTxId" TEXT;

-- CreateTable
CREATE TABLE "DonationPaymentEvidence" (
    "id" TEXT NOT NULL,
    "donationPaymentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amountLinked" MONEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationPaymentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonationPaymentEvidence_donationPaymentId_idx" ON "DonationPaymentEvidence"("donationPaymentId");

-- CreateIndex
CREATE INDEX "DonationPaymentEvidence_transactionId_idx" ON "DonationPaymentEvidence"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationPaymentEvidence_donationPaymentId_transactionId_key" ON "DonationPaymentEvidence"("donationPaymentId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationPayment_interestTxId_key" ON "DonationPayment"("interestTxId");

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_interestTxId_fkey" FOREIGN KEY ("interestTxId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPaymentEvidence" ADD CONSTRAINT "DonationPaymentEvidence_donationPaymentId_fkey" FOREIGN KEY ("donationPaymentId") REFERENCES "DonationPayment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationPaymentEvidence" ADD CONSTRAINT "DonationPaymentEvidence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
