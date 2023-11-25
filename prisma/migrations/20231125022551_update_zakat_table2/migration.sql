/*
  Warnings:

  - Made the column `beneficiaryType` on table `ZakatPayment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `zakatId` on table `ZakatPayment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ZakatPayment" DROP CONSTRAINT "ZakatPayment_zakatId_fkey";

-- AlterTable
ALTER TABLE "ZakatPayment" ALTER COLUMN "beneficiaryType" SET NOT NULL,
ALTER COLUMN "zakatId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_zakatId_fkey" FOREIGN KEY ("zakatId") REFERENCES "Zakat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
