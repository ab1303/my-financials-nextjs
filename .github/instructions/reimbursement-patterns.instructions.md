---
applyTo: "src/server/trpc/router/transaction-ledger.ts,src/components/transactions/TransactionRow.tsx"
---

# Reimbursement Feature — Guardrails

These rules exist because they were broken in production and required repeated debugging.
Read before touching `updateCategory`, `searchDebitTransactions`, or `TransactionRow`.

## ❌ NEVER add a guard blocking CONFIRMED CREDITs from becoming Reimbursement

```typescript
// ❌ WRONG — kills all real-world reimbursement assignments
if (transaction.status === 'CONFIRMED' && transaction.type === 'CREDIT') {
  throw new TRPCError({ message: 'Cannot reclassify confirmed income as Reimbursement' });
}
```

**Why:** All bank-imported CREDITs are auto-confirmed. This guard blocks 100% of use cases.
**Alternative:** UI visibility via `showReimbursementOption` is the correct access control layer.

## ❌ NEVER filter `searchDebitTransactions` with `offsetTransactionId: null`

```typescript
// ❌ WRONG — no-op; DEBIT rows always have offsetTransactionId = null
where: { type: 'DEBIT', offsetTransactionId: null }
```

**Why:** `offsetTransactionId` is the FK on CREDIT rows, not DEBIT rows.
**Correct filter:** `reimbursements: { none: {} }` (the Prisma back-relation).

## ❌ NEVER use `status: { in: ['CONFIRMED', 'EXCLUDED'] }` for the DEBIT link search

```typescript
// ❌ WRONG — includes Transfer DEBITs (EXCLUDED) which fail validation and confuse users
where: { type: 'DEBIT', status: { in: ['CONFIRMED', 'EXCLUDED'] } }
```

**Correct filter:**
```typescript
OR: [
  { status: 'CONFIRMED' },
  { status: 'EXCLUDED', category: REIMBURSEMENT_CATEGORY }, // awaiting payback DEBITs
],
```

## ❌ NEVER fire `handleLinkTransaction` without resolving `offsetCategory`

```typescript
// ❌ WRONG — throws BAD_REQUEST if user selects a linked DEBIT before choosing offset category
onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, localOffsetCategory || undefined, linkedId);
```

**Correct:** Auto-derive `offsetCategory` from `linkedOption.category` if `localOffsetCategory` is empty.
`LinkOption` must include a `category` field from the server response.

## ✅ Correct `offsetTransactionId` validation in `updateCategory`

A linked DEBIT can be either:
1. `status: CONFIRMED` — a regular expense not yet marked awaiting payback
2. `status: EXCLUDED, category: REIMBURSEMENT_CATEGORY` — already marked "awaiting payback"

Both are valid link targets. Any other EXCLUDED DEBIT (Transfer etc.) must be rejected.
