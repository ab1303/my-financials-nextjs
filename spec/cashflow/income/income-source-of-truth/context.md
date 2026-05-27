# Income Source of Truth — Context

## Problem

The app currently maintains two separate tables for what is fundamentally one financial fact:

```
CSV Import → Transaction (truth)     + IncomeRecord (copy with transactionId link)
Manual add → IncomeRecord (direct)
```

This duplication caused:
- **Sync bugs**: `csv-confirm.service.ts` never set `transactionId`, leaving orphaned copies
- **Duplicate income rows** in UI (same salary showing twice from different sources)
- **Void complexity**: Required separate `reverseIncomeRecord` / `reapplyIncomeRecord` logic
- **Architectural debt**: All three major OSS financial apps (Firefly III, Maybe Finance, Actual Budget) use a single source

## Correct Architecture (Verified by Industry Standard)

**All income — both imported and manual — goes into the `Transaction` table.**

```
CSV Import → Transaction (type=CREDIT, source=BANK/LLM_CLASSIFIED, status=CONFIRMED)
Manual add → Transaction (type=CREDIT, source=MANUAL, status=CONFIRMED)

getIncomeEntries = SELECT * FROM Transaction 
                   WHERE type='CREDIT' AND status='CONFIRMED' AND date IN fiscal year
```

**No UNION, no sync, no duplication.**

Benefits:
- Void a CREDIT transaction → `status = VOIDED` → automatically excluded from income (no secondary cleanup)
- Recategorize income → single record update (no projection sync)
- Manual and imported income use identical code paths (same table, same mutations)

## Domain Dependencies

- Uses `Transaction` and `CalendarYear` from the shared data model.
- `IncomeSource` remains as a **vocabulary** — the category lookup for income source names (Salary, Freelance, etc.), not a container.
- Fiscal-year scoping is done via `Transaction.date` range, not `IncomeLedger`.
- `void.service.ts` void/restore cycle is simplified — no income-specific sync needed.

## Scope

**In scope:**
- Delete `IncomeRecord` and `IncomeLedger` tables entirely (tables remain during transition; see schema migration).
- Migrate manual `IncomeRecord` entries to `Transaction(type=CREDIT, source=MANUAL)` rows.
- Rewrite `getIncomeEntries` to query `Transaction` directly instead of `IncomeRecord`.
- Remove `IncomeRecord` creation from `csv-confirm.service.ts`.
- Remove `reverseIncomeRecord`, `reapplyIncomeRecord`, and related sync logic from `void.service.ts`.
- Update UI to present `Transaction.source` as the discriminator for read-only (BANK) vs editable (MANUAL).
- Delete orphaned `IncomeRecord` rows from the current database.

**Out of scope:**
- Modifying `ExpenseCategory` or `IncomeSource` CRUD beyond current workflows.
- Altering the `CalendarYear` or fiscal-year scoping model (now done via `date` range).
- Removing deprecated tables from schema (separate migration task).
