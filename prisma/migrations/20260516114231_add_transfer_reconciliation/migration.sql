/*
  Warnings:

  - A unique constraint covering the columns `[transferLinkedTransactionId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "preLinkCategory" TEXT,
ADD COLUMN     "preLinkStatus" "TransactionStatusEnum",
ADD COLUMN     "transferLinkedTransactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transferLinkedTransactionId_key" ON "Transaction"("transferLinkedTransactionId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferLinkedTransactionId_fkey" FOREIGN KEY ("transferLinkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
