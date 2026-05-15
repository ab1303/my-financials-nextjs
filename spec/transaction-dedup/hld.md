# Transaction Deduplication — High Level Design

**Version:** 1.0
**Status:** Specced
**Feature:** CSV import deduplication — detect and skip duplicate transactions on overlapping date-range uploads

---

## 1. Problem Statement

The CSV import wizard creates `Transaction` rows and downstream aggregates (`MonthlyExpenseSummary` for debits, `IncomeRecord` for credits) with no duplicate detection. When a user uploads a CSV with a date range that overlaps a previous import (e.g., Jan–Mar followed by Jan–Jun), every transaction in the overlap is inserted again — doubling expense roll-ups, creating duplicate income entries, and orphaning user overrides (manual category corrections, reimbursement links, offset categories) that exist only on the original rows.

Reference apps (Copilot Money, Monarch Money, YNAB) all handle this by matching incoming CSV lines against existing transactions and either auto-skipping duplicates or prompting the user to confirm matches. We follow Copilot Money's zero-friction approach: auto-skip with a reported count, no user prompt.

---

## 2. Goals

- Detect duplicate transactions during CSV confirm by matching on `(userId, bankAccountId, date, description, amount, type)`
- Auto-skip duplicates — do not insert a `Transaction` row, do not write downstream `MonthlyExpenseSummary` or `IncomeRecord`
- Preserve all user overrides on existing rows (category, offsetCategory, offsetTransactionId, source, status)
- Report the number of skipped duplicates in the results step
- Keep the dedup O(n) via batch pre-fetch, not O(n²) with per-row queries

## Non-Goals (Phase 1)

- Duplicate review UI (user confirms/rejects matched pairs)
- Formal `@@unique` constraint on the composite key
- Retroactive dedup of existing duplicate rows already in the database
- Cross-bank-account duplicate detection
- AI-assisted fuzzy matching for similar but non-identical descriptions

---

## 3. Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Matching key** | `(userId, bankAccountId, date, description, amount, type)` | Natural composite key for a bank statement line. Two rows from the same bank account on the same date with the same description and amount are the same real-world transaction. |
| 2 | **Duplicate handling** | Auto-skip (silent) | Matches Copilot Money's approach — zero friction for the common case. A review UI adds complexity with minimal value since bank CSVs are deterministic. Phase 2 can add review for edge cases. |
| 3 | **Existing row preservation** | Leave untouched | The original row may have user-applied `category`, `offsetCategory`, `offsetTransactionId`, `source = USER_OVERRIDE`. The incoming CSV row carries only the LLM classification. The user's work always wins. |
| 4 | **Batch pre-fetch strategy** | Single `findMany` per month range, then in-memory `Set` lookup | Avoids N+1 queries. Typical month has 30–200 transactions — fits comfortably in memory. The existing `@@index([userId, bankAccountId, date])` covers the WHERE clause. |
| 5 | **Description normalisation** | `.trim().toLowerCase()` before key construction | Bank CSVs may have trailing whitespace or case variance across exports. Matches the existing `merchantCategoryMap` pattern (`tx.description.toLowerCase().trim()`). |
| 6 | **Amount normalisation** | `toFixed(2)` string in the lookup key | `Transaction.amount` is `Decimal @db.Money`. CSV amounts arrive as JS `number`. Fixed-precision avoids floating-point mismatch (e.g., `12.1` vs `12.10`). |
| 7 | **Results display** | New "Duplicates Skipped" row in `CSVResultsStep` | Uses neutral `text-muted-foreground` styling (same as creditsExcluded) — informational, not an error. Only shown when count > 0. |
| 8 | **MonthlyExpenseSummary safety** | No rollback needed | Because the duplicate `Transaction` row is never created, the `upsertMonthlyExpenseSummary` call is also skipped. No need to detect and reverse prior double-counting. |
| 9 | **IncomeRecord safety** | No rollback needed | Same as above — the duplicate credit `Transaction` is never created, so no `IncomeRecord` is created either. |
| 10 | **MerchantCategoryMap** | No change needed | Already uses `upsert` with `@@unique([userId, description])` — inherently idempotent regardless of dedup. |
| 11 | **Same-day same-amount edge case** | Accept false positive in Phase 1 | Genuinely rare. Two identical $5.00 coffees at the same merchant on the same day would cause one to be skipped. Phase 2 could add count-based matching (allow N duplicates if N exist in the incoming CSV). |
| 12 | **No schema migration** | WHERE-clause dedup only | The existing index `@@index([userId, bankAccountId, date])` covers the primary lookup. A formal `@@unique` constraint is a Phase 2 hardening step to prevent non-CSV code paths from creating duplicates. |

---

## 4. Data Model Changes

### Phase 1 — No schema changes

The dedup check uses a `findMany` with a WHERE clause on existing indexed fields. No new columns, indexes, or constraints.

### Phase 2 (future) — Composite unique constraint

```prisma
model Transaction {
  // ... all existing fields ...
  @@unique([userId, bankAccountId, date, description, amount, type], name: "unique_transaction_natural_key")
}
```

This would enforce dedup at the database level, catching any code path that bypasses the service layer. Requires a migration and a one-time retroactive dedup to clean existing duplicates before the constraint can be applied.

---

## 5. Component / Service Changes (High Level)

### New service: `dedup.service.ts`

- `buildDedupSet(userId, bankAccountId, dateRange)` — batch-fetches existing transactions, returns a `Set<string>` of normalised keys
- `makeDedupKey(date, description, amount, type)` — constructs a normalised lookup key
- `isDuplicate(key, dedupSet)` — checks membership

### Modified service: `csv-confirm.service.ts`

- `confirmDebitTransactions` — calls `buildDedupSet` before the transaction loop; checks each tx against the set; skips if duplicate
- `confirmCreditTransactions` — same pattern
- Both return `duplicatesSkipped` count in `TransactionSaveResult`

### Modified route: `confirm/route.ts`

- Aggregates `duplicatesSkipped` from both results
- Includes in JSON response

### Modified UI: `CSVResultsStep.tsx`

- Reads `duplicatesSkipped` from `CSVImportResult`
- Displays conditionally (only when > 0)

---

## 6. UX Reference

| App | Dedup approach |
|---|---|
| **Copilot Money** | Auto-skips duplicates silently; shows count; no user prompt |
| **Monarch Money** | Detects duplicates and shows a review list; user confirms each |
| **YNAB** | Matches by date+amount+payee; flags as "likely duplicate"; user approves or imports |

**We follow Copilot Money's pattern** — auto-skip with reported count. This is appropriate for Phase 1 because:
- Bank CSVs are deterministic (same export = same rows)
- Users are not expected to have two genuinely different transactions with identical `(date, description, amount, type)` frequently
- A review UI adds significant complexity with marginal value for the common case

---

## 7. Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Uploading the same CSV twice produces zero new `Transaction` rows on the second import | Unit test + manual test |
| 2 | `MonthlyExpenseSummary` amounts are unchanged after a duplicate import | Unit test |
| 3 | `IncomeRecord` count is unchanged after a duplicate import | Unit test |
| 4 | `duplicatesSkipped` count in the API response equals the number of overlapping transactions | Unit test on confirm route |
| 5 | CSVResultsStep displays "Duplicates Skipped: N" when N > 0 | Component test |
| 6 | CSVResultsStep does not display the duplicates row when N = 0 | Component test |
| 7 | User overrides (category, offsetCategory, offsetTransactionId) on original rows are untouched after duplicate import | Unit test |
| 8 | A CSV with partial overlap (some new, some duplicate) correctly saves new rows and skips duplicates | Unit test |
| 9 | Description matching is case-insensitive and whitespace-trimmed | Unit test |
| 10 | Amount matching uses fixed 2-decimal precision | Unit test |
| 11 | `pnpm run build` passes after all changes | CI |
| 12 | Existing unit tests continue to pass | CI |

---

## 8. Out of Scope / Future Phases

| Item | Phase |
|---|---|
| Duplicate review UI (user confirms/rejects matched pairs) | Phase 2 |
| Formal `@@unique` constraint on Transaction composite key | Phase 2 |
| Retroactive dedup tool (find and merge existing duplicate rows) | Phase 2 |
| Partial overlap detection at upload time (warn before classify step) | Phase 2 |
| Cross-bank-account duplicate detection | Future |
| AI-assisted fuzzy matching (similar but not identical descriptions) | Future |
| Dedup for AI image imports (different flow, different matching strategy) | Future |
| Count-based matching for same-day same-amount edge cases | Phase 2 |