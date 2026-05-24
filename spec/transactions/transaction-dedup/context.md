# Transaction Deduplication — Context

## Problem

The CSV import wizard creates `Transaction` rows with no duplicate detection. When a user uploads a CSV with a date range that overlaps a previous import, every transaction in the overlap is inserted again — doubling expense roll-ups, creating duplicate income entries, and orphaning user overrides (manual category corrections, reimbursement links) that exist only on the original rows.

Additionally, a dedup key based only on `(date, description, amount, type)` incorrectly suppresses **legitimate separate transactions** that happen to share those four fields — for example, three $197.73 payments to "HOME AFFAIRS" on the same day, or two consecutive $5.00 weekly transfers on the same date. The bank's running account balance after each transaction is the authoritative differentiator: if the balance differs, the transactions are different.

## Domain Dependencies

- Uses: `Transaction` model from domain HLD; existing `@@index([userId, bankAccountId, date])` covers the dedup WHERE clause
- Patterns: Batch pre-fetch `findMany` + in-memory `Set` lookup (O(n) not O(n²))
- Related features: transactions (dedup runs inside the confirm step), transaction-clearing (VOIDED transactions must be excluded from dedup set — see Gap section)

## Scope

**In scope:**
- Detect duplicates during CSV confirm by matching `(userId, bankAccountId, date, description, amount, type, runningBalance?)`
- `runningBalance` is the 6th key component when available — it disambiguates legitimate same-day same-amount transactions from true duplicates
- Auto-skip duplicates silently — no user prompt
- Preserve all user overrides on original rows (category, offsetCategory, source, status)
- Report `duplicatesSkipped` count in the results step
- Exclude VOIDED transactions from the dedup set (re-import after undo must be allowed)
- Store `runningBalance` on every new Transaction row so future dedup checks include it

**Out of scope:**
- Duplicate review UI (user confirms/rejects matched pairs)
- Formal `@@unique` constraint on the composite key (Phase 2 hardening)
- Retroactive dedup of existing duplicate rows already in the database
- Cross-bank-account duplicate detection
- AI-assisted fuzzy matching for similar but non-identical descriptions

## Known Constraints

- Running balance is optional per bank format — ANZ and Westpac stubs do not expose balance. When `runningBalance` is absent (null/undefined), the key falls back to the 5-field form `date|desc|amount|type`, matching legacy behavior and accepting the slim risk of false-dedup for same-day same-amount transactions at those banks.
- Description normalisation: `.trim().toLowerCase()` — bank CSVs may have trailing whitespace or case variance
- Amount normalisation: `toFixed(2)` string — `Transaction.amount` is `Decimal @db.Money`; fixed-precision avoids float mismatch
- VOIDED rows must be excluded: after Undo, re-importing the same transactions must not be blocked (see Gap AD-13)
- Existing transactions imported before this fix have `runningBalance = null` — they fall back to 5-field key gracefully; no retroactive migration required

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `runningBalance Decimal?` to `Transaction` model |
| `src/server/services/ai-import/_types.ts` | MODIFY | Add `balance?: number` to `ClassifiedTransaction`, `ClassifiedTransactionV2`, `ClassifiedCreditTransaction` |
| `src/server/services/ai-import/csv-classifier.service.ts` | MODIFY | Thread `balance` from `CsvTransaction` input through to classified output |
| `src/server/services/transactions/dedup.service.ts` | MODIFY | Update `DedupKeyParams` + `makeDedupKey` to include `runningBalance?`; update `buildDedupSet` to select + include `runningBalance` |
| `src/server/services/transactions/csv-confirm.service.ts` | MODIFY | Pass `tx.balance` to `makeDedupKey` and `createTransactionRecord`; store `runningBalance` on Transaction |
