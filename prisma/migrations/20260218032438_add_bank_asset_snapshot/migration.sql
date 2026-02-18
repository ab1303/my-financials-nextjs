-- CreateTable
CREATE TABLE "public"."BankAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankAssetSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAssetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankAssetEntry" (
    "id" TEXT NOT NULL,
    "balance" MONEY NOT NULL,
    "accountId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAssetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccount_userId_bankId_idx" ON "public"."BankAccount"("userId", "bankId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_name_bankId_userId_key" ON "public"."BankAccount"("name", "bankId", "userId");

-- CreateIndex
CREATE INDEX "BankAssetSnapshot_userId_snapshotDate_idx" ON "public"."BankAssetSnapshot"("userId", "snapshotDate");

-- CreateIndex
CREATE INDEX "BankAssetEntry_snapshotId_idx" ON "public"."BankAssetEntry"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAssetEntry_accountId_snapshotId_key" ON "public"."BankAssetEntry"("accountId", "snapshotId");

-- AddForeignKey
ALTER TABLE "public"."BankAccount" ADD CONSTRAINT "BankAccount_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAssetSnapshot" ADD CONSTRAINT "BankAssetSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAssetEntry" ADD CONSTRAINT "BankAssetEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankAssetEntry" ADD CONSTRAINT "BankAssetEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."BankAssetSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
