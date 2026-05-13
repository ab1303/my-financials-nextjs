-- CreateTable
CREATE TABLE "TransactionCategoryOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCategoryOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionCategoryOverride_userId_idx" ON "TransactionCategoryOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCategoryOverride_userId_description_key" ON "TransactionCategoryOverride"("userId", "description");

-- AddForeignKey
ALTER TABLE "TransactionCategoryOverride" ADD CONSTRAINT "TransactionCategoryOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
