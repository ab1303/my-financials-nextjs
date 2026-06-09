# Transaction Deduplication — Context

## Problem
CSV imports without deduplication create duplicate records for overlapping date ranges, inflating financial aggregates and orphaning user overrides (manual category corrections).

## Architecture
- **Dedup Key**: `(userId, bankAccountId, date, description, amount, type, runningBalance?)`.
- **Logic**: `src/server/services/transactions/dedup.service.ts` builds an in-memory `Set` of existing transaction keys to skip duplicates during import.
- **Persistence**: `runningBalance` on `Transaction` model acts as a tiebreaker for legitimate same-day, same-amount transactions.

## Scope
- Detect duplicates during CSV confirmation.
- Auto-skip duplicates silently.
- Preserve user overrides on existing records.
- Exclude `VOIDED` transactions from deduplication sets.
