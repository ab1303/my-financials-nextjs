/*
  Warnings:

  - You are about to drop the `DonationPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DonationPaymentEvidence` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DonationPayment" DROP CONSTRAINT "DonationPayment_businessId_fkey";

-- DropForeignKey
ALTER TABLE "DonationPayment" DROP CONSTRAINT "DonationPayment_donationLedgerId_fkey";

-- DropForeignKey
ALTER TABLE "DonationPayment" DROP CONSTRAINT "DonationPayment_individualId_fkey";

-- DropForeignKey
ALTER TABLE "DonationPayment" DROP CONSTRAINT "DonationPayment_interestTxId_fkey";

-- DropForeignKey
ALTER TABLE "DonationPaymentEvidence" DROP CONSTRAINT "DonationPaymentEvidence_donationPaymentId_fkey";

-- DropForeignKey
ALTER TABLE "DonationPaymentEvidence" DROP CONSTRAINT "DonationPaymentEvidence_evidenceTransactionId_fkey";

-- DropTable
DROP TABLE "DonationPayment";

-- DropTable
DROP TABLE "DonationPaymentEvidence";
