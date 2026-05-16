# Clear Transactions — High Level Design

## Problem Statement

The app's import-confirm pipeline has no reversal mechanism. Once a user confirms a CSV or AI import, the downstream financial aggregates (`MonthlyExpenseSummary`, `IncomeRecord`) are permanently written with no path to correction other than manually re-importing corrected data — which compounds the incorrect values rather than replacing them.

The `IncomeRecord` model has no foreign key back to the `Transaction` that created it, making any reversal of CREDIT transactions fragile and match-based rather than precise.

---

## Goals

1. **Import Session Undo** — allow a user to reverse an entire import session atomically: all downstream writes are reversed, all transactions in the session are marked `VOIDED`.
2. **Individual Transaction Void** — allow voiding a single confirmed or excluded transaction from the ledger table (lower priority, same reversal logic).
3. **Fix the `IncomeRecord → Transaction` FK gap** — add `transactionId` to `IncomeRecord` so CREDIT reversals are deterministic, not fuzzy-matched.

---

## Non-Goals (Out of Scope)

| What | Why |
|---|---|
| Hard-deleting `Transaction` records | Audit trail must be preserved; VOIDED is the correct state |
| Re-importing after undo automatically | User manually imports corrected file after undo |
| Partial session undo (undo some rows, keep others) | Phase 1 is all-or-nothing per session; individual void covers partial corrections |
| Undoing category edits (`USER_OVERRIDE` source) | Category re-rollup is already handled in `ledger.service.ts`; out of scope here |
| Undo of AI image imports | Same mechanism applies but UI surface deferred |

---

## Architecture

### Reversal is always atomic

Import Session Undo runs inside a `prisma.$transaction([...])` block. If any step fails (e.g. a `MonthlyExpenseSummary` row is missing), the entire undo is rolled back and the user sees an error. Partial reversal creates worse data corruption than the original problem.

### `VOIDED` is a terminal state

A voided transaction cannot be re-confirmed. It is permanently excluded from all financial aggregate queries. The ledger table filters VOIDED transactions to a dedicated "Voided" tab.

### The IncomeRecord FK fix is a prerequisite for Phase 2

Without `IncomeRecord.transactionId`, the service must find the matching income record by `(incomeLedgerId, dateEarned, amount)`. If two credits have the same amount on the same day (e.g. two salary splits), the wrong record may be deleted. The FK makes the delete exact. **The schema migration runs in Phase 1 before any void logic is built.**

### `onDelete: SetNull` — not `Cascade`

The `IncomeRecord.transactionId` FK uses `onDelete: SetNull` (same as `DonationPayment.transactionId`) so that directly deleting a `Transaction` row (edge case, admin tooling) does not cascade-delete the income record. The void service explicitly deletes the `IncomeRecord` during a controlled void; it does not rely on cascade.

---

## Data Model Changes

### 1. `TransactionStatusEnum` — add `VOIDED`

```prisma
enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
  VOIDED      // ← NEW — downstream writes have been reversed
}
```

### 2. `ImportStatusEnum` — add `VOIDED`

```prisma
enum ImportStatusEnum {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
  VOIDED      // ← NEW — entire session has been reversed
}
```

### 3. `IncomeRecord` — add `transactionId` FK

```prisma
model IncomeRecord {
  // ... existing fields ...
  transaction    Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId  String?      @unique
}
```

Back-reference on `Transaction`:
```prisma
model Transaction {
  // ... existing fields ...
  incomeRecord   IncomeRecord?   // ← NEW back-ref (one transaction → at most one income record)
}
```

### 4. Backfill migration

A data migration script matches existing `IncomeRecord` rows to `Transaction` rows by `(userId via incomeLedger → calendarId, dateEarned, amount)`. Where an exact match is found, `incomeRecord.transactionId` is set. Unmatched records (pre-Transaction-model data) remain with `transactionId = null`.

---

## Reversal Logic Summary

### DEBIT CONFIRMED → VOIDED

```
1. Find ExpenseLedger for (userId, calendarYear from transaction.date)
2. Find ExpenseCategory by name (transaction.category)
3. Decrement MonthlyExpenseSummary.amount by transaction.amount
   - If resulting amount ≤ 0: delete the MonthlyExpenseSummary row
4. Set transaction.status = VOIDED, transaction.confirmedAt = null
```

### CREDIT CONFIRMED → VOIDED

```
1. Find IncomeRecord via transaction.incomeRecord (FK, exact)
   - Fallback: find by (incomeLedgerId, dateEarned, amount) if transactionId is null (pre-migration records)
2. Delete IncomeRecord
3. Set transaction.status = VOIDED, transaction.confirmedAt = null
```

### EXCLUDED → VOIDED

```
1. Set transaction.status = VOIDED (no downstream to reverse)
```

### Import Session Undo (bulk)

```
1. Load all transactions WHERE importSessionId = X AND userId = Y AND status != VOIDED
2. Run reversal for each (inside prisma.$transaction)
3. Set importSession.status = VOIDED
```

---

## API Surface

### tRPC mutations (new router: `transactionClearing`)

| Procedure | Input | What it does |
|---|---|---|
| `undoImportSession` | `{ importSessionId: string }` | Atomic reversal of all non-VOIDED transactions in the session |
| `voidTransaction` | `{ transactionId: string }` | Void a single transaction (any non-VOIDED status) |

Both procedures scope by `ctx.session.user.id` and throw `NOT_FOUND` if the session/transaction doesn't belong to the user.

---

## UI Surface

### Import Session History panel (new, on `/cashflow/transactions`)

- Shows recent import sessions (last 20, ordered by `createdAt DESC`)
- Each row: date, file type (CSV/AI), records count, status badge
- Status `COMPLETED` or `PARTIAL` → shows "Undo" button
- Status `VOIDED` → shows "Undone" badge (no action)
- "Undo" opens a confirmation modal: "This will reverse X transactions and their financial records. This cannot be re-done."

### Void action in `TransactionLedgerTable` (new column)

- Only shown for `CONFIRMED` and `EXCLUDED` transactions
- Icon button with trash/ban icon; triggers confirmation popover
- After void: row status changes to `VOIDED` inline (optimistic update)
- VOIDED tab shows all voided transactions (read-only, no action)

---

## Implementation Phases

| Phase | Scope | Dependency |
|---|---|---|
| **Phase 1** | Schema migration: VOIDED enum values + `IncomeRecord.transactionId` FK + backfill | None |
| **Phase 2** | `void.service.ts` + `transactionClearing` tRPC router | Phase 1 |
| **Phase 3** | Import Session History UI + Undo confirmation modal | Phase 2 + Transaction Ledger table (existing) |
| **Phase 4** | Individual void button in `TransactionLedgerTable` | Phase 2 + Transaction Ledger table |
