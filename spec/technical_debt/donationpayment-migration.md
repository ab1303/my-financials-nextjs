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
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "VoluntaryDonationEvidence" (
  id TEXT PRIMARY KEY,
  voluntaryDonationId TEXT NOT NULL,
  transactionId TEXT NOT NULL,
  amountLinked MONEY,
  confidence REAL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT voluntary_evidence_unique UNIQUE (voluntaryDonationId, transactionId)
);

-- InterestCleansing and evidence
CREATE TABLE IF NOT EXISTS "InterestCleansing" (
  id TEXT PRIMARY KEY,
  datePaid TIMESTAMP NOT NULL,
  amount MONEY NOT NULL,
  sourceBusinessId TEXT,
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
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ZakatEvidence" (
  id TEXT PRIMARY KEY,
  zakatPaymentId TEXT NOT NULL,
  transactionId TEXT NOT NULL,
  amountLinked MONEY,
  confidence REAL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT zakat_evidence_unique UNIQUE (zakatPaymentId, transactionId)
);
```

Phase 2 — Backfill strategy (idempotent Node script)

Overview of backfill rules:

- For each `DonationPayment` row:
  - If `donationPurpose = 'INTEREST_CLEANSING'`:
    - Create or find `InterestCleansing` with `creditTxId = donation.interestTxId` (if interestTxId present) or create a new row using `datePaid` and `amount`.
    - For each `DonationPaymentEvidence` linked to this donationPayment, create `InterestCleansingEvidence` pointing to the matching transaction id and amountApplied.
  - If `donationPurpose = 'ZAKAT'`:
    - Create `ZakatPayment`, mapping `donationLedgerId` -> `zakatObligationId` when possible (fallback: create obligation or log for manual review).
    - Create `ZakatEvidence` rows for evidence.
  - Else (VOLUNTARY):
    - Create `VoluntaryDonation` and `VoluntaryDonationEvidence` rows.

Idempotency rules:

- Use natural unique keys when inserting (e.g., use `donationPayment.id` as the new record `id` to make insert idempotent).
- Skip creation if target table already contains a row with same id.
- Upsert evidence rows by unique constraint (donation/evidence pair).

Backfill script sketch (Node + Prisma) — file: `scripts/backfill-donationpayment.ts`

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const payments = await prisma.donationPayment.findMany({
    include: { evidence: true },
  });
  for (const p of payments) {
    if (p.donationPurpose === 'INTEREST_CLEANSING') {
      // upsert InterestCleansing using original id to remain idempotent
      await prisma.interestCleansing.upsert({
        where: { id: p.id },
        update: { amount: p.amount, datePaid: p.datePaid },
        create: {
          id: p.id,
          amount: p.amount,
          datePaid: p.datePaid,
          donationLedgerId: p.donationLedgerId,
          creditTxId: p.interestTxId,
        },
      });
      for (const e of p.evidence) {
        await prisma.interestCleansingEvidence.upsert({
          where: {
            interestCleansingId_transactionId: {
              interestCleansingId: p.id,
              transactionId: e.evidenceTransactionId,
            },
          },
          update: { amountLinked: e.amountApplied },
          create: {
            id: e.id,
            interestCleansingId: p.id,
            transactionId: e.evidenceTransactionId,
            amountLinked: e.amountApplied,
            confidence: e.confidence ?? 0,
          },
        });
      }
    } else if (p.donationPurpose === 'ZAKAT') {
      await prisma.zakatPayment.upsert({
        where: { id: p.id },
        update: { amount: p.amount, datePaid: p.datePaid },
        create: {
          id: p.id,
          amount: p.amount,
          datePaid: p.datePaid,
          zakatObligationId: p.donationLedgerId,
          beneficiaryType: p.beneficiaryType,
          businessId: p.businessId,
          individualId: p.individualId,
        },
      });
      for (const e of p.evidence) {
        await prisma.zakatEvidence.upsert({
          where: {
            zakatPaymentId_transactionId: {
              zakatPaymentId: p.id,
              transactionId: e.evidenceTransactionId,
            },
          },
          update: { amountLinked: e.amountApplied },
          create: {
            id: e.id,
            zakatPaymentId: p.id,
            transactionId: e.evidenceTransactionId,
            amountLinked: e.amountApplied,
            confidence: e.confidence ?? 0,
          },
        });
      }
    } else {
      // VOLUNTARY
      await prisma.voluntaryDonation.upsert({
        where: { id: p.id },
        update: { amount: p.amount, datePaid: p.datePaid },
        create: {
          id: p.id,
          amount: p.amount,
          datePaid: p.datePaid,
          donationLedgerId: p.donationLedgerId,
          beneficiaryType: p.beneficiaryType,
          businessId: p.businessId,
          individualId: p.individualId,
        },
      });
      for (const e of p.evidence) {
        await prisma.voluntaryDonationEvidence.upsert({
          where: {
            voluntaryDonationId_transactionId: {
              voluntaryDonationId: p.id,
              transactionId: e.evidenceTransactionId,
            },
          },
          update: { amountLinked: e.amountApplied },
          create: {
            id: e.id,
            voluntaryDonationId: p.id,
            transactionId: e.evidenceTransactionId,
            amountLinked: e.amountApplied,
            confidence: e.confidence ?? 0,
          },
        });
      }
    }
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

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
