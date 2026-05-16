# Clear Transactions — Context

## Problem

Once a CSV or AI import is confirmed, there is no way to reverse it. `Transaction` records are permanently `CONFIRMED`, and their downstream aggregates (`MonthlyExpenseSummary`, `IncomeRecord`) remain in place even if the user imported the wrong file, imported duplicates, or simply changed their mind.

Two compounding gaps exist:

1. **No clearing/void UI or API** — the `TransactionStatusEnum` has no `VOIDED` state; no reversal logic exists anywhere in the codebase.
2. **No FK from `IncomeRecord` → `Transaction`** — when a CREDIT transaction is confirmed, it creates an `IncomeRecord` matched only by `(userId via ledger, dateEarned, amount)`. Without a direct FK, any reversal must use a fragile fuzzy match. This gap is already flagged in `spec/transaction-ledger/lld.md §2.4` as "recommended before Phase 3".

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/server/services/transactions/void.service.ts` | Core reversal logic — decrement `MonthlyExpenseSummary`, delete `IncomeRecord`, mark `Transaction` VOIDED |
| `src/server/api/routers/transaction-clearing.ts` | tRPC router — `undoImportSession` + `voidTransaction` mutations |
| `src/components/transactions/ImportSessionHistory.tsx` | Client Component — list of past import sessions with "Undo" action |
| `src/components/transactions/VoidTransactionButton.tsx` | Inline void button for the `TransactionLedgerTable` row |

### Files to MODIFY

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `VOIDED` to `TransactionStatusEnum`; add `VOIDED` to `ImportStatusEnum`; add `transactionId` FK to `IncomeRecord` |
| `src/server/api/root.ts` | Register `transactionClearing` router |
| `src/components/transactions/TransactionLedgerTable.tsx` | Add void action column; filter VOIDED rows in "all" tab |
| `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx` | Add `<ImportSessionHistory>` section below import cards |

### Files to READ (patterns to reuse)

| File | What to Reuse |
|---|---|
| `src/server/services/transactions/ledger.service.ts` | `rerollupExpenseSummary()` — inverse: decrement instead of increment |
| `prisma/schema.prisma` `DonationPayment.transactionId` | `onDelete: SetNull` FK pattern for optional Transaction back-reference |
| `src/server/api/routers/transaction-ledger.ts` | `protectedProcedure`, ownership check pattern (`tx.userId !== userId → NOT_FOUND`) |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx` | `onImportComplete` callback pattern — reuse `onUndoComplete` counterpart |

---

## Schema Details

### Current `Transaction` model (relevant fields)

```prisma
model Transaction {
  id              String                @id @default(cuid())
  status          TransactionStatusEnum @default(PENDING)   // PENDING | CONFIRMED | EXCLUDED
  type            TransactionTypeEnum                       // DEBIT | CREDIT
  amount          Decimal               @db.Money
  date            DateTime
  category        String
  importSession   ImportSession?        @relation(fields: [importSessionId], references: [id])
  importSessionId String?
  userId          String
  donationPayment DonationPayment?      // already has back-ref FK
}
```

### Current `IncomeRecord` model (gap highlighted)

```prisma
model IncomeRecord {
  id             String               @id @default(cuid())
  dateEarned     DateTime
  amount         Decimal              @db.Money
  source         IncomeSourceEnumType
  incomeLedger   IncomeLedger         @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId String
  // ⚠️ NO transactionId FK — matching is currently by (ledger.userId, dateEarned, amount)
}
```

### Current `ImportSession` model (relevant fields)

```prisma
model ImportSession {
  id           String           @id @default(cuid())
  userId       String
  importType   ImportTypeEnum
  status       ImportStatusEnum  // PENDING | PROCESSING | COMPLETED | PARTIAL | FAILED
  transactions Transaction[]
  createdAt    DateTime         @default(now())
}
```

### Current `MonthlyExpenseSummary` (reversal target for DEBITs)

```prisma
model MonthlyExpenseSummary {
  id              String          @id @default(cuid())
  month           Int             // 1–12
  amount          Decimal         @db.Money
  categoryId      String
  expenseLedgerId String
}
```

---

## Downstream Write Map (what gets reversed)

| Transaction type | Status | Written on confirm | Must reverse on void |
|---|---|---|---|
| `DEBIT` | `CONFIRMED` | `MonthlyExpenseSummary` (incremented) | Decrement `MonthlyExpenseSummary`; delete row if amount reaches ≤ 0 |
| `CREDIT` | `CONFIRMED` | `IncomeRecord` (created) | Delete `IncomeRecord` via `transactionId` FK (after schema fix) |
| `EXCLUDED` | `EXCLUDED` | Nothing | Nothing — just mark VOIDED |

---

## Existing Patterns to Reuse

### Ownership guard (from `transaction-ledger.ts`)
```typescript
const tx = await ctx.db.transaction.findUnique({ where: { id: input.id } });
if (!tx || tx.userId !== userId) {
  throw new TRPCError({ code: 'NOT_FOUND' });
}
```

### `DonationPayment.transactionId` FK pattern (already in schema)
```prisma
model DonationPayment {
  transaction   Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId String?      @unique
}
```
`IncomeRecord` must adopt the same pattern — `onDelete: SetNull` so deleting a `Transaction` does not cascade-delete the `IncomeRecord` (we want to void both independently).

### Toast + refetch pattern
`sonner` `toast.success()` / `toast.error()` after mutation; `refetch()` from tRPC `useQuery` to refresh the ledger table.

---

## What Does NOT Exist Today

- `TransactionStatusEnum.VOIDED` — does not exist
- `ImportStatusEnum.VOIDED` — does not exist
- `IncomeRecord.transactionId` — does not exist
- Any void/reversal service, route, or UI
- Import session history list in the UI
