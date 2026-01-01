-- AlterTable
ALTER TABLE "public"."ZakatPayment" ADD COLUMN     "individualId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."ZakatPayment" ADD CONSTRAINT "ZakatPayment_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "public"."Individual"("id") ON DELETE SET NULL ON UPDATE CASCADE;
