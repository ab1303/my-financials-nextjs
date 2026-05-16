# Interest Cleansing — High-Level Design

## Problem & Solution

The bank interest page is a manual data island with no connection to the transaction ledger or the donation system. In the Islamic faith context this app serves, bank interest (riba) is haram and must be fully donated to charity — yet the system tracks the receipt of interest and the cleansing donations in completely separate, unlinked models. A user who imports bank CSV statements (which contain interest CREDIT lines) still has to manually re-enter the same figures on the bank interest page, and then again cannot connect those payments to the Donations page. The result is triple data entry with no audit trail.

The solution is to make the `Transaction` ledger the primary source for interest received and `DonationPayment` (extended with a `donationPurpose` discriminator) the single model for all cleansing payments — whether those payments were made via bank transfer (and thus appear as DEBIT transactions) or via cash (and thus have no ledger trace). The bank interest page becomes an **Interest Cleansing Dashboard** that derives its figures from these two ledgers, with manual override fields kept for edge cases not covered by CSV import.

---

## Architecture Decisions

### 1. Add `DonationPurposeEnum` to `DonationPayment` rather than a new model

**Decision**: Extend `DonationPayment` with `donationPurpose DonationPurposeEnum @default(VOLUNTARY)` instead of creating a new `InterestCleansingPayment` model.

**Rationale**: A cleansing donation IS a donation — it has a beneficiary, a tax category, a date, and an amount. Reusing `DonationPayment` means the Donations page and its audit reports already show interest-cleansing donations without any additional work. A separate model would fragment the donations data model and require duplicate UI.

### 2. `Transaction` ledger is the primary source; `BankInterestLiability.amountDue` is a manual override

**Decision**: The "amount received" per month is derived at query time from `Transaction(CREDIT, category="Bank Interest")` aggregated by month. `BankInterestLiability.amountDue` is retained as a nullable manual override for months where no CSV data exists.

**Rationale**: The ledger-first principle is established across the rest of the app (see expense and donation flows). Manual entry should be the exception, not the rule. Keeping the override field avoids breaking users who do not import bank CSV files.

### 3. Deprecate `BankInterestPayment`; migrate existing rows to `DonationPayment(INTEREST_CLEANSING)`

**Decision**: Add a deprecation comment to `BankInterestPayment` in the schema and migrate all existing rows to `DonationPayment` with `donationPurpose = INTEREST_CLEANSING` and `transactionId = null`.

**Rationale**: Maintaining two separate models for "payments that cleanse interest" creates divergence. After migration, the `BankInterestPayment` table is empty and can be dropped in a future cleanup migration. The model is kept in schema during transition to avoid breaking existing tRPC procedures until they are removed.

### 4. Manual entry is a first-class path, not a fallback

**Decision**: The `CleanseDonationDrawer` exposes a mode toggle: **Link to transaction** (bank transfer captured in CSV) vs **Manual entry** (cash, cheque, direct payment). Both produce a `DonationPayment(INTEREST_CLEANSING)` — the only difference is whether `transactionId` is set.

**Rationale**: Cash donations to charities, mosques, or community organisations are common in this user community. Treating manual entry as a second-class citizen would block legitimate cleansing records. The `📝 Manual` status badge provides audit transparency without a UX penalty.

### 5. Status badge is computed, not stored

**Decision**: `CleansingStatus` (`CLEANSED | PARTIAL | PENDING | MANUAL`) is a derived value computed at query time from `balance = receivedTotal - cleansedTotal`. It is never persisted.

**Rationale**: Storing computed state creates sync drift whenever underlying transactions or donations are edited. Deriving it on read is cheap for 12-row monthly data.

### 6. Summary cards replace the page subtitle

**Decision**: The page header gains three summary metric cards (Received / Cleansed / Remaining) derived from the annual totals.

**Rationale**: Popular apps (Monarch Money, Copilot, YNAB) surface the key metric — the obligation gap — at the top. A user should see their cleansing shortfall without scrolling. The "Remaining" card uses amber/red colour when balance > $0 to create the YNAB-style "unassigned" nudge.

### 7. Scope to ANNUAL calendar year only (Zakat year excluded)

**Decision**: Bank interest tracking uses `CalendarEnumType.ANNUAL` only, consistent with the existing implementation.

**Rationale**: The ATO assesses bank interest on a calendar year (Jan–Dec) basis in the existing system. Zakat uses a separate lunar/fiscal year and has its own obligation model. Mixing them in this page would increase complexity without user value.

---

## Data Model Changes

### Schema Diff

```prisma
// NEW enum
enum DonationPurposeEnum {
  VOLUNTARY          // all existing donations (default)
  INTEREST_CLEANSING // payments that cleanse bank interest (riba)
}

// MODIFIED model
model DonationPayment {
  // ... all existing fields unchanged ...
  donationPurpose  DonationPurposeEnum  @default(VOLUNTARY)  // NEW FIELD
}

// COMMENT ADDED (no column change)
// BankInterestPayment — DEPRECATED. Existing rows migrated to DonationPayment(INTEREST_CLEANSING).
// This model will be dropped in a future migration once tRPC procedures referencing it are removed.
model BankInterestPayment { ... }

// BankInterestLiability.amountDue — role changes from "primary entry" to "manual override"
// No column type change; semantic change only.
model BankInterestLiability { ... }
```

### Derived Type (no schema change)

```typescript
type CleansingStatus = 'CLEANSED' | 'PARTIAL' | 'PENDING' | 'MANUAL';

// CLEANSED  — balance === 0, at least one linked (tx-backed) donation
// MANUAL    — balance === 0, all donations are manual (transactionId = null)
// PARTIAL   — balance > 0, some donations exist
// PENDING   — balance > 0, no donations exist
```

---

## Component & Service Changes

| Layer | Change |
|---|---|
| `interest-cleansing.service.ts` (new) | Core query: join Transaction + DonationPayment + BankInterestLiability by month; return `InterestCleansingMonthSummary[]` |
| `bank-interest.ts` tRPC router | Add `getInterestCleansingData` query; add `getUnlinkedInterestTransactions` query |
| `donations/actions.ts` | Accept `donationPurpose` field in `addRow`; pass through to Prisma `create` |
| `UnlinkedInterestBanner` (new) | Server Component; shows count of months/transactions with balance > $0; CTA opens drawer |
| `CleanseDonationDrawer` (new) | Client Component; mode toggle linked/manual; creates `DonationPayment(INTEREST_CLEANSING)` |
| `BankInterestTableClient` | `amountDue` column → read-only derived display; add Status badge column; add row-level Cleanse button |
| `BankInterestTableServer` | Fetch cleansing summary; pass derived data to client; render banner above table |
| `page.tsx` | Add three summary metric cards above the form |

---

## Success Criteria

| # | Criterion |
|---|---|
| 1 | When bank CSV contains `CREDIT` transactions categorised as `"Bank Interest"`, the monthly table shows the ledger-derived amount without manual entry |
| 2 | A month with $0 interest from the ledger AND $0 manual override shows `—` status (not `PENDING`) |
| 3 | Recording a cleansing donation via the Linked mode creates a `DonationPayment` with `donationPurpose=INTEREST_CLEANSING` and the correct `transactionId` |
| 4 | Recording a cleansing donation via the Manual mode creates a `DonationPayment` with `donationPurpose=INTEREST_CLEANSING` and `transactionId=null` |
| 5 | Both linked and manual donations contribute to the `amountCleansed` total and update the status badge |
| 6 | The `INTEREST_CLEANSING` donations appear on the Donations page under the correct fiscal year |
| 7 | The Remaining summary card turns amber when balance > $0 at any month |
| 8 | Existing `BankInterestPayment` rows are migrated to `DonationPayment(INTEREST_CLEANSING)` without data loss |
| 9 | A month covered entirely by manual cleansing donations shows `📝 Manual` status badge |
| 10 | The page builds with zero TypeScript and ESLint errors (`pnpm run build`) |

---

## Out of Scope / Future Phases

| Item | Reason |
|---|---|
| Dropping `BankInterestPayment` model from schema | Requires removing all tRPC procedures referencing it first; separate cleanup migration |
| Zakat-linked cleansing donations (`ZAKAT_CLEANSING` purpose) | Zakat has its own obligation model; deferred to a dedicated Zakat spec |
| AI-assisted interest categorisation in CSV import | CSV import AI pipeline change; separate spec |
| Multi-currency interest amounts | All values assumed AUD; currency support is a future platform concern |
| Recurring auto-cleanse rules | Future automation feature; not a Phase 1–4 concern |
| Notifications / reminders for uncleansed months | Notification system feature; not in scope here |
