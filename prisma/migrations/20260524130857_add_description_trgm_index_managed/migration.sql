-- CreateIndex
CREATE INDEX "Transaction_description_idx" ON "Transaction" USING GIN ("description" gin_trgm_ops);
