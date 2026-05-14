-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "offsetTransactionId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_offsetTransactionId_fkey" FOREIGN KEY ("offsetTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
