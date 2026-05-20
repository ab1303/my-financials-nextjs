# Transaction Deduplication — Context

## Problem

The CSV import wizard creates `Transaction` rows with no duplicate detection. When a user uploads a CSV with a date range that overlaps a previous import, every transaction in the overlap is inserted again — doubling expense roll-ups, creating duplicate income entries, and orphaning user overrides (manual category corrections, reimbursement links) that exist only on the original rows.

## Domain Dependencies

- Uses: `Transaction` model from domain HLD; existing `@@index([userId, bankAccountId, date])` covers the dedup WHERE clause
- Patterns: Batch pre-fetch `findMany` + in-memory `Set` lookup (O(n) not O(n²))
- Related features: transactions (dedup runs inside the confirm step), transaction-clearing (VOIDED transactions must be excluded from dedup set — see Gap section)

## Scope

**In scope:**
- Detect duplicates during CSV confirm by matching `(userId, bankAccountId, date, description, amount, type)`
- Auto-skip duplicates silently — no user prompt
- Preserve all user overrides on original rows (category, offsetCategory, source, status)
- Report `duplicatesSkipped` count in the results step
- Exclude VOIDED transactions from the dedup set (re-import after undo must be allowed)

**Out of scope:**
- Duplicate review UI (user confirms/rejects matched pairs)
- Formal `@@unique` constraint on the composite key (Phase 2 hardening)
- Retroactive dedup of existing duplicate rows already in the database
- Cross-bank-account duplicate detection
- AI-assisted fuzzy matching for similar but non-identical descriptions

## Known Constraints

- Same-day same-amount edge case: two identical amounts at same merchant on same day → one will be skipped. Accept in Phase 1; Phase 2 can add count-based matching.
- Description normalisation: `.trim().toLowerCase()` — bank CSVs may have trailing whitespace or case variance
- Amount normalisation: `toFixed(2)` string — `Transaction.amount` is `Decimal @db.Money`; fixed-precision avoids float mismatch
- VOIDED rows must be excluded: after Undo, re-importing the same transactions must not be blocked (see Gap AD-13)

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/transactions/dedup.service.ts` | CREATE | `buildDedupSet`, `makeDedupKey`, `isDuplicate` |
| `src/server/services/transactions/csv-confirm.service.ts` | MODIFY | Call `buildDedupSet` before loop; skip duplicates; return `duplicatesSkipped` |
| `src/app/api/transactions/csv/confirm/route.ts` | MODIFY | Aggregate `duplicatesSkipped` in JSON response |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx` | MODIFY | Display "Duplicates Skipped: N" when N > 0 |
