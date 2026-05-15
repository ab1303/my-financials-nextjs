/*
  Warnings:

  - A unique constraint covering the columns `[transactionId]` on the table `DonationPayment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DonationPayment" ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DonationPayment_transactionId_key" ON "DonationPayment"("transactionId");

-- AddForeignKey
ALTER TABLE "DonationPayment" ADD CONSTRAINT "DonationPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
