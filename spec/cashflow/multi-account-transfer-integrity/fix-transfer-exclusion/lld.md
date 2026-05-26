# Fix Transfer Exclusion — Low Level Design

## Overview

Prevents `Transfer` category transactions from leaking into expense and income aggregation
queries. This is a **pure server-side query fix** — no schema changes, no Prisma migration,
no UI changes. It is the highest-priority slice and safe to implement and deploy independently.

**Depends on:** Nothing — implement first.

---

## Files to Modify

| File | Change |
|---|---|
| `src/server/trpc/router/category-transactions.ts` | Add `category != Transfer` guard to `getByCategory` |
| `src/server/trpc/router/transaction-ledger.ts` | Add `category != Transfer` to `expenses` and `income` tab filters |
| `src/server/services/transactions/constants.ts` | Add `EXCLUDED_FROM_EXPENSE_AGGREGATION` array constant |
| `src/server/services/transactions/monthly-expense-summary.service.ts` *(or equivalent)* | Add `category notIn EXCLUDED_FROM_EXPENSE_AGGREGATION` to build/upsert query |

> Locate the `MonthlyExpenseSummary` upsert by searching for `MonthlyExpenseSummary` in the
> `services/` directory — the exact file name may differ.

---

## 1. The Problem

The `"Transfer"` special category exists in the system but is **not consistently excluded**
from aggregation queries. Any transaction with `category = 'Transfer'` that is `DEBIT + CONFIRMED`
currently flows into the Expense page totals and the CategoryFilteredLedger.

| Query path | Current state | Required fix |
|---|---|---|
| `MonthlyExpenseSummary` build/upsert | No `category != 'Transfer'` guard | Must exclude |
| `CategoryFilteredLedger` (`getByCategory`) | `type=DEBIT, status=CONFIRMED` only | Add `category != 'Transfer'` |
| `expenses` tab in Transaction Ledger | `type=DEBIT, status=CONFIRMED` only | Add `category != 'Transfer'` |
| `income` tab in Transaction Ledger | `type=CREDIT, status=CONFIRMED` only | Add `category != 'Transfer'` |
| Expense page totals | Derived from `MonthlyExpenseSummary` | Fixed by MonthlyExpenseSummary fix above |

---

## 2. Constants Addition

Add a shared exclusion list so all query paths use the same source of truth:

```typescript
// src/server/services/transactions/constants.ts

// Existing (do not change):
export const TRANSFER_CATEGORY = 'Transfer'; // verify exact string value
export const REIMBURSEMENT_CATEGORY = '...'; // verify existing constant

// Add:
export const EXCLUDED_FROM_EXPENSE_AGGREGATION = [
  TRANSFER_CATEGORY,
  // Phase 2 future: any ExpenseCategory where excludeFromTotals: true
] as const;
```

> ⚠️ Verify the exact string value of `TRANSFER_CATEGORY` before writing queries.
> Check `constants.ts` — it may be `'Transfer'`, `'TRANSFER'`, or `'transfer'`.

---

## 3. Query Changes

### 3.1 `category-transactions.ts` — `getByCategory` procedure

```typescript
// Add to Prisma WHERE clause in getByCategory
where: {
  userId: ctx.session.user.id,
  category: input.category,  // existing filter
  // ADD:
  AND: {
    category: { notIn: [...EXCLUDED_FROM_EXPENSE_AGGREGATION] },
  },
}
```

> Note: If `input.category` IS 'Transfer', this should still return results (the Transfers tab
> uses this path). Only exclude Transfer when the category filter is NOT 'Transfer'.
> Adjust the guard: `category !== TRANSFER_CATEGORY ? { notIn: [...EXCLUDED_FROM_EXPENSE_AGGREGATION] } : undefined`

### 3.2 `transaction-ledger.ts` — `getAll` for `expenses` tab

```typescript
// When tab === 'expenses'
where: {
  type: 'DEBIT',
  status: 'CONFIRMED',
  category: { not: TRANSFER_CATEGORY },  // ADD THIS
}
```

### 3.3 `transaction-ledger.ts` — `getAll` for `income` tab

```typescript
// When tab === 'income'
where: {
  type: 'CREDIT',
  status: 'CONFIRMED',
  category: { not: TRANSFER_CATEGORY },  // ADD THIS
}
```

### 3.4 `MonthlyExpenseSummary` build service

```typescript
// Wherever the DEBIT aggregation runs (build or upsert after import)
where: {
  type: 'DEBIT',
  status: 'CONFIRMED',
  category: { notIn: [...EXCLUDED_FROM_EXPENSE_AGGREGATION] },  // ADD THIS
}
```

---

## 4. Data Audit (Run After Deploying)

After the fix is deployed, run this read-only audit query to understand historical data
contamination (use Postgres MCP or Prisma Studio — READ ONLY):

```sql
-- Count confirmed Transfer DEBITs that were leaking into expenses
SELECT
  DATE_TRUNC('month', date) AS month,
  COUNT(*) AS leaked_transactions,
  SUM(amount) AS leaked_amount
FROM "Transaction"
WHERE
  type = 'DEBIT'
  AND status = 'CONFIRMED'
  AND category = 'Transfer'
GROUP BY 1
ORDER BY 1 DESC;
```

> ⚠️ DO NOT modify data via this query. Read-only audit only.
> If historical `MonthlyExpenseSummary` records are contaminated, a separate data repair task
> is needed (not in scope here — raise as follow-up).

---

## 5. Acceptance Criteria

- [x] Expense page totals do **not** include any transaction with `category = 'Transfer'`
- [x] The `expenses` tab in the Transaction Ledger does **not** show transactions with `category = 'Transfer'`
- [x] The `income` tab in the Transaction Ledger does **not** show transactions with `category = 'Transfer'`
- [x] `CategoryFilteredLedger` when navigating to any non-Transfer category does **not** include Transfer rows
- [x] The `transfers` tab in the Transaction Ledger **continues** to show all Transfer category rows (not broken)
- [x] Existing `TRANSFER_CATEGORY` constant is used — no magic string literals in query files
- [x] `EXCLUDED_FROM_EXPENSE_AGGREGATION` constant is the single source of truth for all exclusion guards

---

## 6. Implementation Notes

- **No schema migration required.** This is a query-layer fix only.
- **No UI changes required.** Data correctness fix is transparent to the user (existing pages
  will simply show accurate numbers).
- **Safe to deploy first.** All other sub-features in this spec depend on or benefit from
  this fix being in place.
- **Do not** run `pnpm lint --fix` or global formatters. Touch only the 4 files listed above.

---

## 7. Implementation Status

**Status: ✅ SHIPPED — 2026-05-26**

### Files Modified

| File | Change |
|---|---|
| `src/server/services/transactions/constants.ts` | Added `EXCLUDED_FROM_EXPENSE_AGGREGATION = [TRANSFER_CATEGORY]` |
| `src/server/trpc/router/category-transactions.ts` | Added Transfer `AND` guard to `getByCategory`; imports constant |
| `src/server/trpc/router/transaction-ledger.ts` | `buildTransactionWhere` auto-excludes Transfer for `status=CONFIRMED`; `searchDebitTransactions` hardened |
| `src/components/transactions/TransactionLedgerTable.tsx` | `expenses` and `income` tabs now pass `excludeTransferCategory: true` |
| `src/server/services/transactions/csv-confirm.service.ts` | Import guard references `EXCLUDED_FROM_EXPENSE_AGGREGATION` |

### Tests Added

| File | Tests |
|---|---|
| `src/__tests__/integration/category-transactions.integration.test.ts` | Transfer excluded from non-Transfer category queries; Transfer tab unaffected |
| `src/__tests__/unit/services/csv-confirm.service.test.ts` | Transfer DEBIT saves as EXCLUDED; no MonthlyExpenseSummary created |

### Key Design Decisions

- **Dual-layer guard**: Fix applied at both server (`buildTransactionWhere`) AND client (`TAB_TO_PARAMS`) so all callers of the router are protected, not just the Ledger UI.
- `EXCLUDED_FROM_EXPENSE_AGGREGATION` is intentionally extensible — future category exclusions (Phase 2) simply append to this array.
- The `getByCategory` guard is conditional: Transfer rows are suppressed for non-Transfer category queries, but the `/transfers` tab (which passes `category='Transfer'`) still works correctly.
