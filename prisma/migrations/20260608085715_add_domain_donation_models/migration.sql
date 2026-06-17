/*
  Warnings:

  - Added the required column `updatedAt` to the `ZakatPayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ZakatPayment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(19,4);

-- CreateTable
CREATE TABLE "VoluntaryDonation" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "beneficiaryType" "BeneficiaryEnumType" NOT NULL,
    "businessId" TEXT,
    "individualId" TEXT,
    "donationLedgerId" TEXT NOT NULL,
    "purpose" "DonationPurposeEnum" NOT NULL DEFAULT 'VOLUNTARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoluntaryDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoluntaryDonationEvidence" (
    "id" TEXT NOT NULL,
    "voluntaryDonationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amountLinked" DECIMAL(19,4),
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoluntaryDonationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestCleansing" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "sourceBusinessId" TEXT,
    "donationLedgerId" TEXT NOT NULL,
    "creditTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterestCleansing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestCleansingEvidence" (
    "id" TEXT NOT NULL,
    "interestCleansingId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amountLinked" DECIMAL(19,4),
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestCleansingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZakatEvidence" (
    "id" TEXT NOT NULL,
    "zakatPaymentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amountLinked" DECIMAL(19,4),
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZakatEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoluntaryDonationEvidence_voluntaryDonationId_idx" ON "VoluntaryDonationEvidence"("voluntaryDonationId");

-- CreateIndex
CREATE INDEX "VoluntaryDonationEvidence_transactionId_idx" ON "VoluntaryDonationEvidence"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "VoluntaryDonationEvidence_voluntaryDonationId_transactionId_key" ON "VoluntaryDonationEvidence"("voluntaryDonationId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "InterestCleansing_creditTxId_key" ON "InterestCleansing"("creditTxId");

-- CreateIndex
CREATE INDEX "InterestCleansingEvidence_interestCleansingId_idx" ON "InterestCleansingEvidence"("interestCleansingId");

-- CreateIndex
CREATE INDEX "InterestCleansingEvidence_transactionId_idx" ON "InterestCleansingEvidence"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "InterestCleansingEvidence_interestCleansingId_transactionId_key" ON "InterestCleansingEvidence"("interestCleansingId", "transactionId");

-- CreateIndex
CREATE INDEX "ZakatEvidence_zakatPaymentId_idx" ON "ZakatEvidence"("zakatPaymentId");

-- CreateIndex
CREATE INDEX "ZakatEvidence_transactionId_idx" ON "ZakatEvidence"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ZakatEvidence_zakatPaymentId_transactionId_key" ON "ZakatEvidence"("zakatPaymentId", "transactionId");

-- AddForeignKey
ALTER TABLE "VoluntaryDonation" ADD CONSTRAINT "VoluntaryDonation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoluntaryDonation" ADD CONSTRAINT "VoluntaryDonation_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoluntaryDonation" ADD CONSTRAINT "VoluntaryDonation_donationLedgerId_fkey" FOREIGN KEY ("donationLedgerId") REFERENCES "DonationLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoluntaryDonationEvidence" ADD CONSTRAINT "VoluntaryDonationEvidence_voluntaryDonationId_fkey" FOREIGN KEY ("voluntaryDonationId") REFERENCES "VoluntaryDonation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoluntaryDonationEvidence" ADD CONSTRAINT "VoluntaryDonationEvidence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestCleansing" ADD CONSTRAINT "InterestCleansing_sourceBusinessId_fkey" FOREIGN KEY ("sourceBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestCleansing" ADD CONSTRAINT "InterestCleansing_donationLedgerId_fkey" FOREIGN KEY ("donationLedgerId") REFERENCES "DonationLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestCleansing" ADD CONSTRAINT "InterestCleansing_creditTxId_fkey" FOREIGN KEY ("creditTxId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestCleansingEvidence" ADD CONSTRAINT "InterestCleansingEvidence_interestCleansingId_fkey" FOREIGN KEY ("interestCleansingId") REFERENCES "InterestCleansing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestCleansingEvidence" ADD CONSTRAINT "InterestCleansingEvidence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatEvidence" ADD CONSTRAINT "ZakatEvidence_zakatPaymentId_fkey" FOREIGN KEY ("zakatPaymentId") REFERENCES "ZakatPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatEvidence" ADD CONSTRAINT "ZakatEvidence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
