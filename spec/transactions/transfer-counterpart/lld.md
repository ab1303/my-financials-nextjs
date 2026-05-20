# Transfer Counterpart Display — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1** | `src/server/api/routers/transaction-ledger.ts` | Include counterpart fields in `getAll` query + coalesce in output mapping |
| **2** | `src/server/api/routers/transaction-ledger.ts` | Add `transferCounterpart` shape to `TransactionRow` type |
| **3** | `src/components/transactions/TransactionRow.tsx` | Render counterpart summary chip inline on linked rows |

No schema changes. No new tRPC procedures. No migrations.

---

## Phase 1 — tRPC Query

**File:** `src/server/api/routers/transaction-ledger.ts`

Replace the existing minimal counterpart include with full fields:

```typescript
// Replace:
transferCounterpart: { select: { id: true } },

// With:
transferLinkedTransaction: {
  select: {
    id: true,
    date: true,
    description: true,
    amount: true,
    type: true,
    bankAccount: { select: { name: true, bank: { select: { name: true } } } },
  },
},
transferCounterpart: {
  select: {
    id: true,
    date: true,
    description: true,
    amount: true,
    type: true,
    bankAccount: { select: { name: true, bank: { select: { name: true } } } },
  },
},
```

Why both relations: `transferLinkedTransaction` is the FK side (DEBIT holds the FK pointing to CREDIT). `transferCounterpart` is the back-relation (CREDIT's view). Exactly one will be non-null on any linked row.

---

## Phase 2 — TransactionRow Type Extension

In `TransactionRow` interface:

```typescript
export interface TransferCounterpartSummary {
  id:             string;
  date:           string;    // ISO date
  description:    string;
  amount:         number;
  type:           string;
  bankAccountName: string | null;
  bankName:        string | null;
}

export interface TransactionRow {
  // ... all existing fields ...
  transferCounterpartId: string | null;       // kept for backwards compat
  transferCounterpart:   TransferCounterpartSummary | null; // NEW
}
```

In the mapping block, replace:
```typescript
transferCounterpartId: tx.transferCounterpart?.id ?? null,
```
With:
```typescript
transferCounterpartId: tx.transferCounterpart?.id ?? null, // backwards compat
transferCounterpart: (() => {
  const raw = tx.transferLinkedTransaction ?? tx.transferCounterpart ?? null;
  if (!raw) return null;
  return {
    id:              raw.id,
    date:            raw.date.toISOString(),
    description:     raw.description,
    amount:          Number(raw.amount),
    type:            raw.type as string,
    bankAccountName: raw.bankAccount?.name ?? null,
    bankName:        raw.bankAccount?.bank?.name ?? null,
  };
})(),
```

---

## Phase 3 — Counterpart Chip in TransactionRow

**File:** `src/components/transactions/TransactionRow.tsx`

```tsx
{transaction.transferCounterpart && (
  <div className="mt-1 flex items-center gap-1.5 rounded bg-gray-100 px-2 py-0.5 text-xs
                  text-gray-600 dark:bg-gray-700 dark:text-gray-300">
    <FiLink className="shrink-0" />
    <span className="truncate max-w-[180px]" title={transaction.transferCounterpart.description}>
      {transaction.transferCounterpart.description}
    </span>
    <span className="shrink-0">
      ${Math.abs(transaction.transferCounterpart.amount).toFixed(2)}
    </span>
    {transaction.transferCounterpart.bankAccountName && (
      <span className="shrink-0 opacity-70">
        · {transaction.transferCounterpart.bankAccountName}
      </span>
    )}
  </div>
)}
```

---

## Files

| File | Action | Description |
|---|---|---|
| `src/server/api/routers/transaction-ledger.ts` | MODIFY | Include full counterpart select fields; add `TransferCounterpartSummary` to output shape |
| `src/components/transactions/TransactionRow.tsx` | MODIFY | Render counterpart chip below description on linked rows |
