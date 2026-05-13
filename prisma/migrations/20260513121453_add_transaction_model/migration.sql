-- CreateEnum
CREATE TYPE "TransactionTypeEnum" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "TransactionSourceEnum" AS ENUM ('LLM_CLASSIFIED', 'USER_OVERRIDE');

-- CreateEnum
CREATE TYPE "TransactionStatusEnum" AS ENUM ('PENDING', 'CONFIRMED', 'EXCLUDED');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" MONEY NOT NULL,
    "type" "TransactionTypeEnum" NOT NULL,
    "category" TEXT NOT NULL,
    "source" "TransactionSourceEnum" NOT NULL,
    "status" "TransactionStatusEnum" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "bankAccountId" TEXT,
    "userId" TEXT NOT NULL,
    "importSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_userId_bankAccountId_date_idx" ON "Transaction"("userId", "bankAccountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_status_idx" ON "Transaction"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "Transaction_importSessionId_idx" ON "Transaction"("importSessionId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
