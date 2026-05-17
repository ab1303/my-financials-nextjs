-- CreateTable
CREATE TABLE "TransferMatchRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "amountExact" MONEY,
    "amountMin" MONEY,
    "amountMax" MONEY,
    "debitKeywords" TEXT[],
    "creditKeywords" TEXT[],
    "maxDayGap" INTEGER NOT NULL DEFAULT 5,
    "debitBankAccountId" TEXT,
    "creditBankAccountId" TEXT,
    "confidenceThreshold" INTEGER NOT NULL DEFAULT 85,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferMatchRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferMatchJobResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "ruleId" TEXT,
    "autoLinkedCount" INTEGER NOT NULL DEFAULT 0,
    "flaggedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferMatchJobResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferMatchRule_userId_isActive_idx" ON "TransferMatchRule"("userId", "isActive");

-- CreateIndex
CREATE INDEX "TransferMatchJobResult_userId_importSessionId_idx" ON "TransferMatchJobResult"("userId", "importSessionId");

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_debitBankAccountId_fkey" FOREIGN KEY ("debitBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchRule" ADD CONSTRAINT "TransferMatchRule_creditBankAccountId_fkey" FOREIGN KEY ("creditBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchJobResult" ADD CONSTRAINT "TransferMatchJobResult_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMatchJobResult" ADD CONSTRAINT "TransferMatchJobResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransferMatchRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
