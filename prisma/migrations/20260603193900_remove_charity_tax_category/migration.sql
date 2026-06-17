-- Remove duplicated charity tax category storage.
-- Deductibility is now derived from Business.isDgrRegistered.

ALTER TABLE "DonationPayment" DROP COLUMN IF EXISTS "taxCategory";
ALTER TABLE "ZakatPayment" DROP COLUMN IF EXISTS "taxCategory";
