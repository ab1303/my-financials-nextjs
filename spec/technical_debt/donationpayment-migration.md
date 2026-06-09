# DonationPayment Full Redesign — Migration & Backfill Plan

This document contains the migration ordering, SQL snippets, and an idempotent Node backfill script plan to move data from `DonationPayment` + `DonationPaymentEvidence` into the new domain tables while preserving frontend API shapes.

High-level migration phases

1. Add new tables (create migration) — non-destructive.
2. Backfill data from old tables to new tables using an idempotent script; log ambiguous rows for manual review.
3. Feature-flag server changes to write to new domain tables while keeping API DTOs unchanged.
4. Reconciliation & verification: totals, counts, sample records.
5. Final cutover: once verified, remove legacy `DonationPayment` columns and `DonationPaymentEvidence` (final migration).

Phase 1 — SQL to create tables (non-destructive)

Run as migration (example Postgres SQL statements):

```sql
-- VoluntaryDonation
CREATE TABLE IF NOT EXISTS "VoluntaryDonation" (
  id TEXT PRIMARY KEY,
  datePaid TIMESTAMP NOT NULL,
  amount MONEY NOT NULL,
  beneficiaryType TEXT NOT NULL,
  businessId TEXT,
  individualId TEXT,
  donationLedgerId TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'VOLUNTARY',
  transactionId TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- InterestCleansing and evidence
CREATE TABLE IF NOT EXISTS "InterestCleansing" (
  id TEXT PRIMARY KEY,
  datePaid TIMESTAMP NOT NULL,
  amount MONEY NOT NULL,
  businessId TEXT,
  donationLedgerId TEXT NOT NULL,
  creditTxId TEXT UNIQUE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "InterestCleansingEvidence" (
  id TEXT PRIMARY KEY,
  interestCleansingId TEXT NOT NULL,
  transactionId TEXT NOT NULL,
  amountLinked MONEY,
  confidence REAL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cleansing_evidence_unique UNIQUE (interestCleansingId, transactionId)
);

-- ZakatPayment and evidence
CREATE TABLE IF NOT EXISTS "ZakatPayment" (
  id TEXT PRIMARY KEY,
  datePaid TIMESTAMP NOT NULL,
  amount MONEY NOT NULL,
  beneficiaryType TEXT NOT NULL,
  businessId TEXT,
  individualId TEXT,
  zakatObligationId TEXT NOT NULL,
  transactionId TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Phase 2 — Backfill strategy (idempotent Node script)

Overview of backfill rules:

- For each `DonationPayment` row:
  - If `donationPurpose = 'INTEREST_CLEANSING'`:
    - Create or find `InterestCleansing` with `creditTxId = donation.interestTxId` (if interestTxId present) or create a new row using `datePaid` and `amount`.
    - For each `DonationPaymentEvidence` linked to this donationPayment, create `InterestCleansingEvidence` pointing to the matching transaction id and amountApplied.
  - If `donationPurpose = 'ZAKAT'`:
    - Create `ZakatPayment`, mapping `donationLedgerId` -> `zakatObligationId` when possible.
  - Else (VOLUNTARY):
    - Create `VoluntaryDonation`.

Idempotency rules:

- Use natural unique keys when inserting (e.g., use `donationPayment.id` as the new record `id` to make insert idempotent).
- Skip creation if target table already contains a row with same id.

Phase 3 — Server feature flagging

- Introduce feature flag (env var) `USE_NEW_DONATION_MODELS`.
- Under the flag, writes use new models; reads for ledger items still use `Transaction` + new domain model mapping for detail endpoints.

Phase 4 — Reconciliation queries (post-backfill)

```sql
-- Totals per calendar: compare old vs new
SELECT dp.donationLedgerId, SUM(dp.amount) FROM "DonationPayment" dp GROUP BY dp.donationLedgerId ORDER BY dp.donationLedgerId;
SELECT donationLedgerId, SUM(amount) FROM "VoluntaryDonation" GROUP BY donationLedgerId
UNION ALL
SELECT donationLedgerId, SUM(amount) FROM "InterestCleansing" GROUP BY donationLedgerId
UNION ALL
SELECT zakatObligationId AS donationLedgerId, SUM(amount) FROM "ZakatPayment" GROUP BY zakatObligationId;
```

Phase 5 — Final removal (post-approval)

- After verification, create a final migration to drop `DonationPaymentEvidence` and `DonationPayment` or at least drop legacy columns (keep backups).

Ambiguity handling & logging

- Log rows where `donationPurpose` is null/unknown; surface in `migration_ambiguous_rows.log` for manual review.
- For Zakat: map `donationLedgerId` -> `zakatObligationId` carefully; if mapping fails, write the zakat payment with `zakatObligationId` = NULL and log for manual fix.

Rollback plan

- Keep legacy tables until final verification.
- Backups: require full DB dump snapshot before running migration.
