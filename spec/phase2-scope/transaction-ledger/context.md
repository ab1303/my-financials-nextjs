Domain HLD: `spec/transactions/hld.md`

## Phase 2 Scope — Transaction Ledger Scalability

**Priority:** High  
**Origin:** Identified during Category Rules scalability review (2026-05-24)  
**Prerequisite:** Category Rules feature complete ✅

---

## Problem Summary

The transaction ledger uses **offset-based pagination** (`SKIP` / `TAKE`) with a `COUNT(*)` query on every page load. As a user's transaction history grows (10k–100k rows), two compounding issues emerge:

1. **`COUNT(*)` is slow on large filtered datasets.** Every page turn fires an extra full-table-scan to compute "Page N of M", even when the user doesn't need it.
2. **Deep offset pagination degrades linearly.** `SKIP 9950 TAKE 50` forces Postgres to scan and discard 9,950 rows to return the last page — performance degrades as the dataset grows.

The current design is correct for small datasets (< 5k rows per user) but becomes a bottleneck for power users importing years of bank history.

---

## Domain Dependencies
- `transactionLedgerRouter.getAll` in `src/server/trpc/router/transaction-ledger.ts`
- `buildTransactionWhere()` (lines 162–247) — builds Prisma WHERE clause; no changes needed here
- `TransactionsClient.tsx` — manages page state and passes it to the tRPC query
- Aggregates (sum debit/credit) are separate queries in `Promise.all` — keep as-is; they are bounded by userId + date range, not full-table scans

## Scope

**IN SCOPE:**
- Replace `skip`/`take` + `count` pagination with **cursor-based pagination** using `id` as the cursor
- Return a `nextCursor` in the response instead of `totalCount`
- Update `TransactionsClient` to use infinite scroll or "Load More" UX pattern
- Maintain all existing filter capabilities (date, category, type, status, search, bank account)

**OUT OF SCOPE:**
- Removing the aggregate sum queries (debit/credit totals) — these are bounded by filters
- Changing the filter UI or adding new filters
- Changing the `getFilterOptions` query

## UX Implication
Cursor pagination means "Page N of M" becomes impossible. Replace with one of:
- **"Load More" button** at the bottom of the table (simpler, recommended)
- **Infinite scroll** (more complex, better mobile UX)

Recommended: "Load More" — consistent with the rest of the app's UX patterns and avoids scroll hijacking.

## Known Constraints
- `id` is a CUID string — lexicographic ordering is consistent with `createdAt` ordering
- If the user applies a new filter, the cursor must reset to the beginning
- The `COUNT` query can be fully removed — the "total" is not displayed anywhere in the current UI (only page number is shown, which can be dropped)
