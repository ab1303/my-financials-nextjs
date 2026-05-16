# Donation Transaction Linking — High Level Design

## Problem & Solution

When a user imports a CSV bank statement, DEBIT transactions categorised as "Gifts & donations" land in the expense ledger only — there is no pathway into the Donations page. The Donations page records `DonationPayment` rows that carry tax-relevant metadata (beneficiary, tax category) which CSV data cannot provide. Users must currently duplicate every donation entry: once at import time and once manually on the Donations page.

The solution adds a lightweight **"Classify then Enrich"** flow. The CSV import wizard is unchanged. Instead, the Donations page detects how many "Gifts & donations" DEBIT transactions in the selected fiscal year have no linked `DonationPayment`, surfaces a banner, and provides a drawer for the user to select each unlinked transaction and complete the donation-specific fields (beneficiary + tax category). On save, a `DonationPayment` is created with an optional `transactionId` FK back to the source transaction. Manual donations (no bank transaction) continue to work exactly as today.

---

## Architecture Decisions

1. **Optional FK on DonationPayment, not on Transaction** — `DonationPayment.transactionId String? @unique`. Directionality is correct: a donation payment optionally *came from* a transaction, not the other way around. The `@unique` constraint prevents double-linking. Transaction model stays unchanged.

2. **Enrichment on the Donations page, not inside the import wizard** — keeping the import wizard simple (no extra prompts mid-flow) aligns with the principle of progressive disclosure. The user is in a "tax records" context on the Donations page, which is the right place to think about beneficiaries and categories.

3. **Server Component banner, Client Component drawer** — the unlinked count is a pure server-side query scoped to the logged-in user and the selected fiscal year. No tRPC query needed for the banner itself; it renders server-side via a dedicated `UnlinkedTransactionsBanner` Server Component. The drawer interaction is fully client-side via tRPC.

4. **tRPC for the drawer's data fetching** — the drawer needs to load unlinked transactions interactively (the fiscal year is a URL param, not always known at SSR time). A new `transactionLedger.getUnlinkedDonationTransactions` tRPC procedure handles this with proper user scoping via `ctx.session.user.id`.

5. **Date and Amount locked when linking** — when a user selects a transaction in the drawer, `datePaid` and `amount` are read from the Transaction and cannot be overridden. This preserves accuracy: the donation record matches the bank statement exactly.

6. **`DonationLedger` auto-creation preserved** — the existing `addRow` server action already calls `createDonationYearHandler` to upsert the ledger header. The new linking path reuses this same action, passing `transactionId` as an additional optional field.

7. **Fiscal year date range = July 1 `fromYear` → June 30 `toYear`** — Australian fiscal years. The banner and the tRPC query both compute `startDate = new Date(fromYear, 6, 1)` and `endDate = new Date(toYear, 5, 30, 23, 59, 59)`.

8. **Transaction Ledger badge is read-only UI only** — no new mutation is needed for the badge. The `TransactionRow` component checks `category === 'Gifts & donations'` and queries whether `transactionId` appears in any `DonationPayment`. Implemented as a simple boolean flag returned on the existing `getAll` query output.

---

## Data Model Changes

### Schema diff

```prisma
model DonationPayment {
  // existing fields unchanged ...
  donationLedgerId String
+ transactionId    String?   @unique
+ transaction      Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
}

model Transaction {
  // existing fields unchanged ...
+ donationPayment  DonationPayment?   // back-reference, no FK added here
}
```

### Migration
- Non-destructive: adds a nullable column with `SetNull` on delete.
- Safe on a table with existing rows — no backfill required.

---

## Component & Service Changes

| Layer | Change |
|---|---|
| `prisma/schema.prisma` | Add `transactionId` FK to `DonationPayment` + back-relation on `Transaction` |
| `donation-link.service.ts` (new) | `getUnlinkedDonationTransactions(userId, dateFrom, dateTo)` — raw Prisma query |
| `transaction-ledger.ts` tRPC router | Add `getUnlinkedDonationTransactions` procedure + extend `getAll` to include `isDonationLinked` flag on "Gifts & donations" rows |
| `UnlinkedTransactionsBanner.tsx` (new) | Server Component consuming `donation-link.service` directly |
| `LinkTransactionsDrawer.tsx` (new) | Client Component; two-panel slide-over using tRPC + existing `addRow` action |
| `donations/page.tsx` | Add `<UnlinkedTransactionsBanner>` when `selectedCalendarYear` is present |
| `donations/_types.ts` | `transactionId?: string` on `DonationPaymentType` |
| `donations/actions.ts` | Forward `transactionId` through `addRow` → service |
| `donations/_schema.ts` | `transactionId: z.string().optional()` in `CreateDonationPaymentSchema` |
| `TransactionRow.tsx` | Render `🔗 Linked` / `⚠️ Needs recipient` badge for "Gifts & donations" rows |

---

## Success Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | After CSV import, "Gifts & donations" DEBITs appear in the Donations page banner count | Import CSV with 2 donation rows; Donations page shows "2 unlinked" |
| 2 | Linking a transaction pre-fills date and amount (read-only) | Open drawer, select transaction — fields are locked |
| 3 | After linking, banner count decrements | Save 1 donation — banner shows "1 unlinked" |
| 4 | Linked DonationPayment shows "📥 From import" chip in Donations table | Verify rendered chip |
| 5 | Manually-added DonationPayment (no transaction) still works | Add row via "+" button — no transactionId |
| 6 | Transaction Ledger shows "🔗 Linked" badge after linking | Check TransactionRow for linked donation |
| 7 | Transaction Ledger shows "⚠️ Needs recipient" for unlinked donation debits | Import CSV, view transactions — badge appears |
| 8 | One transaction cannot be linked to two DonationPayments | Unique constraint error on second link attempt |

---

## Out of Scope / Future Phases

| Item | Phase |
|---|---|
| Auto-matching descriptions to existing Beneficiaries (fuzzy/ML) | Phase 2 |
| Bulk-link multiple transactions to one beneficiary | Phase 2 |
| Create Beneficiary inline from within the drawer (portal pattern) | Phase 1 — promoted, see LLD Phase 4.5 |
| Unlink a DonationPayment from a Transaction | Phase 2 |
| Australian DGR tax category pre-populated dropdown | Phase 2 |
| Modifying the CSV import wizard to prompt for donation details | Out of scope |
