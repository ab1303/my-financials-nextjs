# Transaction Enrichment Pipeline — High-Level Design

## Problem & Solution

The Transaction Ledger (bank CSV imports), Donations page, and Zakat page evolved as independent silos. A confirmed "Gifts & donations" bank transaction has no data bridge to `ZakatPayment`, and `CalendarYear` lacks day-level precision needed for lunar-derived Zakat years. This forces users to manually re-enter date and amount on each page, with no audit trail back to the bank statement and a real risk of amount drift.

The solution establishes **Transaction as the source of truth for cash events** (date, amount, bank account) while Donations and Zakat become **enrichment layers** that assign purpose and calendar attribution. A single transaction may simultaneously appear in a FISCAL-year Donation ledger (ATO tax) and a ZAKAT-year obligation ledger — this is not double-counting but correct multi-dimensional reporting for independent obligations.

---

## Architecture Decisions

### 1. Transaction = immutable cash record; enrichment records = intent

`Transaction.date` and `Transaction.amount` are the canonical source for when money left the bank and how much. Enrichment records (`DonationPayment`, `ZakatPayment`) add purpose, beneficiary, and calendar attribution. Neither enrichment record should store a date or amount that contradicts the transaction without explicit user intent (partial attribution is allowed but surfaced clearly).

### 2. No `calendarYearId` on `Transaction`

A transaction with `date = 2024-11-15` simultaneously falls inside FY2025 (FISCAL: Jul 1 2024 – Jun 30 2025) and Zakat Year 1446H (ZAKAT: Jul 7 2024 – Jun 26 2025). Adding a single FK to `Transaction` would imply exclusive ownership by one calendar year, which is architecturally wrong. Calendar attribution is always computed — via the enrichment record's relation to its respective ledger/obligation → calendar year.

### 3. `@unique` FK on each enrichment model prevents same-purpose duplication

`DonationPayment.transactionId @unique` — one transaction → at most one FY donation record.
`ZakatPayment.transactionId @unique` — one transaction → at most one Zakat payment record.
Cross-purpose linking is unrestricted. This enforces the business rule "a payment can only be claimed for one donation record per tax year, and one Zakat payment per obligation" while allowing it to serve both purposes.

### 4. `CalendarYear.fromDay` / `toDay` — additive nullable columns

FISCAL and ANNUAL years always start on the 1st and end on the last day of the stated month. These fields remain `null` (meaning default boundary). ZAKAT years may start/end on specific days (e.g., Jul 7 – Jun 26 for a lunar-derived year). Adding nullable `fromDay Int?` / `toDay Int?` is a non-breaking additive migration — all existing records are unaffected.

### 5. FISCAL = hard date validation; ZAKAT = soft warning

ATO fiscal year boundaries are legally exact. A transaction dated Jul 1 belongs to FY2026, not FY2025 — no exceptions. Zakat year boundaries are user-defined and the lunar calendar is inherently approximate; different scholarly opinions exist on exact start/end dates. The system must warn when a transaction date falls outside the selected Zakat year but must never block the user.

### 6. Mirror the Donations enrichment UX pattern for Zakat

The Donations page already has `UnlinkedTransactionsBanner` + `LinkTransactionsDrawer`. Zakat gets the identical pattern: `UnlinkedZakatBanner` + `LinkZakatDrawer`. Familiar interaction for users already working with the Donations flow. Shared components (BeneficiarySelectionCell, drawer layout) are reused.

### 7. Transaction Ledger becomes the cross-attribution visibility surface

The Transaction Ledger row for a "Gifts & donations" DEBIT should show attribution badges for each purpose it has been linked to. Currently `isDonationLinked` is already computed in `transactionLedgerRouter.getAll`. Adding `isZakatLinked` mirrors this. The badges are informational — management of each attribution happens on its respective page.

### 8. Manual (cash/in-kind) payments remain first-class

`transactionId` is nullable on both `DonationPayment` and `ZakatPayment`. Users who make cash Zakat payments or in-kind donations that do not appear in any bank import continue to enter these manually — no transaction link required. The presence of a `transactionId` is optional enrichment, not a prerequisite.

---

## Data Model Changes

```prisma
// CalendarYear — add day precision (non-breaking)
model CalendarYear {
  // ... existing fields unchanged ...
+ fromDay  Int?   // null = 1st of fromMonth (FISCAL/ANNUAL default)
+ toDay    Int?   // null = last day of toMonth (FISCAL/ANNUAL default)
}

// ZakatPayment — add TWO enrichment FKs (transaction direct path + donation path)
model ZakatPayment {
  // ... existing fields unchanged ...
+ transactionId     String?       @unique
+ transaction       Transaction?  @relation(fields: [transactionId], references: [id], onDelete: SetNull)
+ donationPaymentId String?       @unique
+ donationPayment   DonationPayment? @relation(fields: [donationPaymentId], references: [id], onDelete: SetNull)
  // Invariant: transactionId and donationPaymentId are mutually exclusive — enforced at app layer.
  // If a DonationPayment exists for a transaction, the donationPaymentId path is preferred.
}

// DonationPayment — add Zakat back-reference
model DonationPayment {
  // ... existing fields ...
+ zakatPayment      ZakatPayment?      // NEW back-reference (via donationPaymentId)
}

// Transaction — add Zakat back-reference (direct path only)
model Transaction {
  // ... existing fields unchanged ...
  donationPayment  DonationPayment?   // already exists
+ zakatPayment     ZakatPayment?      // NEW (direct path — when no DonationPayment enrichment)
}
```

**Migration safety:** Both changes are additive. New columns are nullable; no existing rows are affected. `onDelete: SetNull` on the Zakat FK mirrors the Donation FK behaviour — deleting a transaction unlinks (does not delete) the ZakatPayment.

### 9. `donationPaymentId` FK on `ZakatPayment` — the primary Donation→Zakat gap

The original stated need was: *"some donations are made to pay Zakat obligations; there is currently no way to link a donation to Zakat."* The `transactionId` FK alone does not solve this for two reasons: (1) a user who has already enriched a transaction as a `DonationPayment` via the Donations page would need to go back through the raw transaction again; (2) manual cash donations (no `transactionId`) have no path to Zakat at all. Adding `donationPaymentId String? @unique` to `ZakatPayment` enables the Donation→Zakat link directly, regardless of whether the donation was bank-imported or manually entered.

### 10. Mutual exclusion: `transactionId` XOR `donationPaymentId`

A `ZakatPayment` should have at most one source link. If a `DonationPayment` exists for the transaction, the `donationPaymentId` path is preferred — it carries richer metadata (taxCategory, beneficiary type already resolved). The app layer enforces this with a validation check at create time: if both are provided, reject. If a `DonationPayment` exists for the given `transactionId`, suggest the `donationPaymentId` path instead.



| Layer | Change | Type |
|---|---|---|
| `prisma/schema.prisma` | 3 model changes above | Schema |
| `calendar-boundary.service.ts` | New: `getCalendarDateRange()`, `validateTransactionDate()` | New service |
| `donation-zakat-link.service.ts` | New: `getUnlinkedDonationPaymentsForZakat()`, `countUnlinkedDonationPaymentsForZakat()` | New service |
| `zakat-link.service.ts` | New: `getUnlinkedZakatTransactions()`, `countUnlinkedZakatTransactions()` | New service |
| `zakat.service.ts` | `addZakatPaymentDetail()` accepts optional `transactionId` | Modified service |
| `transaction-ledger.ts` (tRPC) | New procedure `getUnlinkedZakatTransactions`; `getAll` includes `zakatPayment` select | Modified router |
| `UnlinkedZakatBanner.tsx` + `UnlinkedDonationsZakatBanner.tsx` | New Server Components — two distinct banners (raw tx path + donation path) | New components |
| `LinkZakatDrawerTrigger.tsx` + `LinkZakatDrawer.tsx` | New Client Components — enrichment slide-over (raw tx path) | New components |
| `LinkDonationsToZakatDrawer.tsx` | New Client Component — enrichment slide-over (donation path) | New components |
| `zakat/page.tsx` | Inject `<UnlinkedZakatBanner>` | Modified page |
| `zakat/actions.ts` | Accept `transactionId?` and `donationPaymentId?` in `addRow`; mutual exclusion validation | Modified action |
| `zakat/_schema.ts` | Add `transactionId` optional field | Modified schema |
| `zakat/_types.ts` | Add `transactionId?` to `ZakatPaymentType` | Modified type |
| `TransactionRow.tsx` | `isZakatLinked` badge checks BOTH direct `zakatPayment` AND `donationPayment.zakatPayment` chain | Modified component |
| `donations/actions.ts` + `donations/form` | "Count toward Zakat?" optional section when saving a DonationPayment | Modified page |
| `settings/calendar/` | Expose `fromDay`/`toDay` inputs for ZAKAT years | Modified page |

---

## Success Criteria

| # | Criterion | Verifiable by |
|---|---|---|
| 1 | A confirmed "Gifts & donations" DEBIT transaction can be linked to a `ZakatPayment` with a FK | DB: `ZakatPayment.transactionId IS NOT NULL` |
| 2 | A single transaction can simultaneously have a `DonationPayment` (FISCAL) and a `ZakatPayment` (ZAKAT) | DB: both FKs pointing to same `Transaction.id` |
| 3 | Deleting a Transaction sets `ZakatPayment.transactionId = NULL` (does not delete the payment) | Integration test |
| 4 | Zakat page shows banner count of unlinked "Gifts & donations" transactions for selected Zakat year | UI + service test |
| 5 | Linking a transaction via the drawer creates a `ZakatPayment` with correct `transactionId` | E2E test |
| 6 | Transaction Ledger shows 🕌 Zakat badge on linked rows | UI unit test |
| 7 | A FISCAL calendar year with `fromDay = null` resolves to the 1st of its `fromMonth` | Service unit test |
| 8 | A ZAKAT calendar year with `fromDay = 7` resolves correctly in date range queries | Service unit test |
| 9 | Attempting to link a transaction outside a FISCAL year's bounds is blocked with an error | Validation test |
| 10 | Attempting to link a transaction outside a ZAKAT year's bounds shows a warning but proceeds | Validation test |
| 11 | Manual Zakat payments (no transaction) continue to work without `transactionId` | Existing test regression |

| 12 | A manual `DonationPayment` (no transactionId) can be linked to a `ZakatPayment` via `donationPaymentId` | DB + integration test |
| 13 | Creating a `ZakatPayment` with both `transactionId` and `donationPaymentId` is rejected | Validation test |
| 14 | Zakat page shows second banner for unlinked `DonationPayment` records (not just raw transactions) | UI + service test |
| 15 | "Count toward Zakat?" toggle on Donations page creates a `ZakatPayment` via `donationPaymentId` | E2E test |
| 16 | Transaction Ledger shows 🕌 badge when `tx.donationPayment.zakatPayment != null` (indirect chain) | UI unit test |

| Item | Reason deferred |
|---|---|
| Zakat obligation calculator from `BankBalanceSnapshot` + `PortfolioSnapshot` | Requires asset valuation logic, Nisab threshold configuration, and hawl date tracking — separate feature |
| Partial amount attribution (ZakatPayment.amount ≠ Transaction.amount) UI | UX complexity; v1 pre-fills full transaction amount, user can edit manually |
| "Count toward Zakat" toggle inside the Donation enrichment drawer | ~~Convenience shortcut~~ **Moved to Phase 7 — this is the primary stated use case** |
| Enforcing `CalendarEnumType` at the FK level (e.g., DonationLedger must link to FISCAL year) | Requires DB-level check constraints or app-layer enforcement — deferred to avoid scope creep |
| Unified charitable giving report (Donations + Zakat combined) | Reporting feature; depends on this pipeline being complete first |
| In-kind / non-cash Zakat payment tracking | No transaction record to link; manual entry already supports this |
