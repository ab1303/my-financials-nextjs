-- SQL Backfill Script for DonationPayments
-- This script migrates data from DonationPayment + DonationPaymentEvidence
-- into purpose-specific tables: VoluntaryDonation, InterestCleansing, ZakatPayment.

BEGIN;

-- Helper to ensure MigrationAudit table exists, just in case
CREATE TABLE IF NOT EXISTS "MigrationAudit" (
    id TEXT PRIMARY KEY,
    "legacyTable" TEXT,
    "legacyId" TEXT,
    "newTable" TEXT,
    "newId" TEXT,
    status TEXT,
    note TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CTE to process data
WITH processed_donations AS (
    SELECT 
        dp.*,
        COALESCE(
            json_agg(
                json_build_object(
                    'id', e.id, 
                    'evidenceTransactionId', e.evidenceTransactionId, 
                    'amountApplied', e.amountApplied, 
                    'confidence', e.confidence
                )
            ) FILTER (WHERE e.id IS NOT NULL), '[]'::json
        ) AS evidence_data
    FROM "DonationPayment" dp
    LEFT JOIN "DonationPaymentEvidence" e ON e.donationPaymentId = dp.id
    GROUP BY dp.id
)

-- Perform insertions based on purpose
-- 1. Interest Cleansing
INSERT INTO "InterestCleansing" (id, "datePaid", amount, "sourceBusinessId", "donationLedgerId", "creditTxId", "createdAt", "updatedAt")
SELECT 
    id, "datePaid", amount, "businessId", "donationLedgerId", "interestTxId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM processed_donations
WHERE "donationPurpose" = 'INTEREST_CLEANSING'
ON CONFLICT (id) DO UPDATE SET 
    amount = EXCLUDED.amount, 
    "datePaid" = EXCLUDED."datePaid", 
    "updatedAt" = EXCLUDED."updatedAt";

-- 2. Zakat
INSERT INTO "ZakatPayment" (id, "datePaid", amount, "beneficiaryType", "businessId", "individualId", "zakatObligationId", "transactionId", "createdAt", "updatedAt")
SELECT 
    id, "datePaid", amount, "beneficiaryType", "businessId", "individualId", "donationLedgerId", "interestTxId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM processed_donations
WHERE "donationPurpose" = 'ZAKAT'
ON CONFLICT (id) DO UPDATE SET 
    amount = EXCLUDED.amount, 
    "datePaid" = EXCLUDED."datePaid", 
    "updatedAt" = EXCLUDED."updatedAt";

-- 3. Voluntary
INSERT INTO "VoluntaryDonation" (id, "datePaid", amount, "beneficiaryType", "businessId", "individualId", "donationLedgerId", "createdAt", "updatedAt")
SELECT 
    id, "datePaid", amount, "beneficiaryType", "businessId", "individualId", "donationLedgerId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM processed_donations
WHERE "donationPurpose" NOT IN ('INTEREST_CLEANSING', 'ZAKAT')
ON CONFLICT (id) DO UPDATE SET 
    amount = EXCLUDED.amount, 
    "datePaid" = EXCLUDED."datePaid", 
    "updatedAt" = EXCLUDED."updatedAt";

-- TODO: Handle evidence insertion via cross-joining with JSON data in processed_donations
-- PostgreSQL's jsonb_array_elements can be used for this.

-- Log MigrationAudit (Simplified - might need a separate loop or function for granular audit per row)
INSERT INTO "MigrationAudit" (id, "legacyTable", "legacyId", "newTable", "newId", status, note, "createdAt", "updatedAt")
SELECT 
    'DonationPayment-' || id,
    'DonationPayment',
    id,
    CASE 
        WHEN "donationPurpose" = 'INTEREST_CLEANSING' THEN 'InterestCleansing'
        WHEN "donationPurpose" = 'ZAKAT' THEN 'ZakatPayment'
        ELSE 'VoluntaryDonation'
    END,
    id,
    'DONE',
    'Backfilled via SQL',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM processed_donations
ON CONFLICT (id) DO UPDATE SET 
    newId = EXCLUDED.newId, 
    status = EXCLUDED.status, 
    note = EXCLUDED.note, 
    "updatedAt" = EXCLUDED."updatedAt";

COMMIT;
