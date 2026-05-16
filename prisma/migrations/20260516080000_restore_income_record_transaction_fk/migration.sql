/*
  Warnings: - A unique constraint covering the columns `[transactionId]` on the table `IncomeRecord` will be added. If there are existing duplicate values, this will fail.
*/
-- AlterTable
ALTER TABLE "IncomeRecord" ADD COLUMN     "transactionId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "IncomeRecord_transactionId_key" ON "IncomeRecord"("transactionId");
-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;