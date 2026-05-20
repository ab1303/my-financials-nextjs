# Transactions (Import Pipeline) — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1** | `csv-classifier.service.ts` | Add `Transfer` to debit LLM prompt |
| **2** | `csv-confirm.service.ts` | Transfer guard: skip `MonthlyExpenseSummary` for Transfer debits |
| **3** | `constants.ts` | `TRANSFER_CATEGORY`, `EXCLUDED_DEBIT_LABELS` constants |

---

## Phase 1 — LLM Classifier Constants

### `src/server/services/transactions/constants.ts`

```typescript
export const REIMBURSEMENT_CATEGORY = 'Reimbursement' as const;
export const TRANSFER_CATEGORY = 'Transfer' as const;

/**
 * CREDIT transaction categories that map to status=EXCLUDED at import time.
 */
export const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded', 'Reimbursement'] as const;

/**
 * DEBIT transaction categories that map to status=EXCLUDED at import time.
 * Transfer debits must not create MonthlyExpenseSummary entries.
 */
export const EXCLUDED_DEBIT_LABELS = ['Transfer'] as const;
```

---

## Phase 2 — CSV Classifier Prompt Update

### `src/server/services/ai-import/csv-classifier.service.ts`

Add `'Transfer'` to the debit system prompt:

```
Available categories:
- [dynamic list from ExpenseCategory table]
- Transfer

Rules:
- Use ONLY the exact category names listed above.
- Use "Transfer" for transactions that move money between your own bank accounts
  (e.g. "Transfer to Savings", "Transfer to Current", "INTER ACCOUNT TRANSFER",
  "BPAY to own account", "OSKO Payment to ANZ", "INT XFER").
- Never use "Transfer" for payments to third parties, merchants, or services.
```

---

## Phase 3 — Confirm Service Guard

### `src/server/services/transactions/csv-confirm.service.ts`

In `confirmDebitTransactions`, add guard before `upsertMonthlyExpenseSummary`:

```typescript
import { EXCLUDED_DEBIT_LABELS } from './constants';

const isTransferDebit = (EXCLUDED_DEBIT_LABELS as readonly string[]).includes(tx.category);

if (isTransferDebit) {
  await createTransactionRecord({
    ...tx,
    type: TransactionTypeEnum.DEBIT,
    status: TransactionStatusEnum.EXCLUDED,
    source: TransactionSourceEnum.LLM_CLASSIFIED,
  });
  result.totalEntries++;
  continue; // skip MonthlyExpenseSummary
}
// Existing path for real expense debits...
```

Both `confirmDebitTransactions` and `confirmCreditTransactions` return `duplicatesSkipped` in `TransactionSaveResult`.

---

## Input/Output Types

```typescript
export interface TransactionSaveResult {
  totalEntries: number;
  savedCount: number;
  skippedCount: number;
  duplicatesSkipped: number;
  errors: string[];
}
```

---

## TDD Test Cases

| Test | Type | What it verifies |
|---|---|---|
| `classifyTransactions` returns `category: 'Transfer'` for "Transfer to ANZ Current" | Unit | LLM prompt includes Transfer |
| `classifyTransactions` does NOT return `'Transfer'` for "Netflix subscription" | Unit | No false-positive on real expenses |
| `confirmDebitTransactions` with Transfer debit → creates `Transaction(EXCLUDED)`, no `MonthlyExpenseSummary` | Unit | Rollup skipped for Transfer debits |
| Mixed debits (Groceries + Transfer) → only Groceries creates summary | Unit | Guard doesn't affect non-Transfer debits |

---

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/transactions/constants.ts` | CREATE | `TRANSFER_CATEGORY`, `EXCLUDED_DEBIT_LABELS` constants |
| `src/server/services/ai-import/csv-classifier.service.ts` | MODIFY | Add Transfer to debit system prompt categories |
| `src/server/services/transactions/csv-confirm.service.ts` | MODIFY | Transfer guard before rollup; return `duplicatesSkipped` |
| `src/app/api/transactions/csv/confirm/route.ts` | MODIFY | Aggregate `duplicatesSkipped` in response |
