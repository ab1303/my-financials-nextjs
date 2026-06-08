/*
  Warnings:

  - You are about to drop the `VoluntaryDonationEvidence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ZakatEvidence` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `VoluntaryDonation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "VoluntaryDonationEvidence" DROP CONSTRAINT "VoluntaryDonationEvidence_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "VoluntaryDonationEvidence" DROP CONSTRAINT "VoluntaryDonationEvidence_voluntaryDonationId_fkey";

-- DropForeignKey
ALTER TABLE "ZakatEvidence" DROP CONSTRAINT "ZakatEvidence_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "ZakatEvidence" DROP CONSTRAINT "ZakatEvidence_zakatPaymentId_fkey";

-- AlterTable
ALTER TABLE "VoluntaryDonation" ADD COLUMN     "transactionId" TEXT;

-- DropTable
DROP TABLE "VoluntaryDonationEvidence";

-- DropTable
DROP TABLE "ZakatEvidence";

-- CreateIndex
CREATE UNIQUE INDEX "VoluntaryDonation_transactionId_key" ON "VoluntaryDonation"("transactionId");

-- AddForeignKey
ALTER TABLE "VoluntaryDonation" ADD CONSTRAINT "VoluntaryDonation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
