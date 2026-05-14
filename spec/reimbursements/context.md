# Reimbursement Tracking — Context## Problem`CREDIT` transactions that the LLM classifies as `Transfer` or `Excluded` are saved with
`status = EXCLUDED` and no downstream record is written. This correctly handles true
inter-account transfers, but silently buries **reimbursements** — money a third party pays
you back after you fronted a shared cost. Because the offsetting credit is excluded, expense
roll-ups are overstated: a $100 dinner you split equally shows as $100 expense with no
$50 offset.---## File Inventory### Files to MODIFY| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `offsetCategory String?` nullable field to `Transaction` model |
| `src/server/trpc/router/transaction-ledger.ts` | Extend `updateCategorySchema` with `offsetCategory`; add reimbursement promotion/demotion logic to mutation; extend `TransactionRow` interface and `getAll` map to surface `offsetCategory` |
| `src/server/services/transactions/ledger.service.ts` | Add `applyReimbursementOffset` and `reverseReimbursementOffset` functions |
| `src/server/services/transactions/csv-confirm.service.ts` | Add `'Reimbursement'` to `EXCLUDED_CREDIT_LABELS` so LLM-pre-classified reimbursements land `EXCLUDED` (same as Transfer) |
| `src/components/transactions/TransactionRow.tsx` | Add "Reimbursement" option to CREDIT+EXCLUDED dropdown; add conditional offset-category `<select>`; extend `onCategoryChange` callback signature |
| `src/components/transactions/TransactionLedgerTable.tsx` | Forward `offsetCategory` argument through `handleCategoryChange` to the `updateCategory` mutation call |### Files to CREATE| File | Role |
|---|---|
| `src/server/services/transactions/constants.ts` | Single source of truth for `REIMBURSEMENT_CATEGORY` string and `EXCLUDED_CREDIT_LABELS` array; imported by router, service, and client |---## Schema Details### `Transaction` model addition```prisma
model Transaction {
  // ... all existing fields unchanged ...  offsetCategory  String?    // populated only when category = 'Reimbursement';
                             // names the ExpenseCategory being offset (free-text FK by name)
}
```**Why a dedicated field instead of encoding as `"Reimbursement:Food & Dining"`:**| Concern | Dedicated field | Encoded string |
|---|---|---|
| Queryability | `WHERE offsetCategory = 'Food & Dining'` | Requires `LIKE 'Reimbursement:%'` |
| Existing `category` readers | Unaffected | Must parse every callsite |
| Prisma type safety | `string \| null` | Always `string`, nullability lost |

### Reserved category string

```typescript
// src/server/services/transactions/constants.ts
export const REIMBURSEMENT_CATEGORY = 'Reimbursement' as const;
export const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded', 'Reimbursement'] as const;
```

`REIMBURSEMENT_CATEGORY` is a **reserved free-text value** for `Transaction.category`. It is
only valid on `CREDIT` transactions; the `updateCategory` mutation enforces this at runtime.
No new Prisma enum is needed.

### Migration

```
migration name : add_transaction_offset_category
command        : pnpm prisma migrate dev --name add_transaction_offset_category
```

The single change is a nullable `String?` column — no default, no backfill required.
Existing rows remain valid with `offsetCategory = NULL`.

---

## Existing Patterns to Reuse

### tRPC router

`src/server/trpc/router/transaction-ledger.ts` uses `router` + `protectedProcedure` from
`@/server/trpc/trpc`, `ctx.prisma` for DB access, `ctx.session.user.id` for tenant
scoping, and `z.object(…)` Zod schemas named `<noun>Schema`.

### Ledger service

`src/server/services/transactions/ledger.service.ts` — functions accept a plain params
object that includes `prismaClient: PrismaClient`. No class, no DI. Return `Promise<void>`.
Call pattern in router: `await fn({ prismaClient: ctx.prisma, userId, … })`.

`rerollupExpenseSummary` is the canonical pattern for adjusting `MonthlyExpenseSummary`:

```typescript
// Lookup chain: FISCAL CalendarYear → ExpenseLedger (calendarId+userId) →
//   ExpenseCategory by name → updateMany(decrement old) + upsert(increment new)
```

The new `applyReimbursementOffset` / `reverseReimbursementOffset` functions follow the
same lookup chain but only touch one category (no old/new pair).

### Toast

`import { toast } from 'sonner'` — `toast.success` / `toast.error` in all existing
`TransactionLedgerTable` mutations. No change needed.

### Optimistic state in `TransactionRow`

```typescript
const [localCategory, setLocalCategory] = useState(transaction.category);
useEffect(() => { setLocalCategory(transaction.category); }, [transaction.category]);
```

Mirror this pattern for a new `localOffsetCategory` state.

### Inline `<select>` styling

```
"w-full min-w-[140px] rounded border border-gray-300 bg-transparent px-2 py-1 text-sm
 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500
 disabled:cursor-wait disabled:opacity-60
 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
```

Reuse verbatim for the offset-category `<select>`.

### `EXCLUDED_CREDIT_LABELS` in csv-confirm.service.ts

```typescript
// Current (line 13):
const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded'];
```

This constant moves to `constants.ts` and gains `'Reimbursement'`. The service imports it
from there. This ensures LLM-pre-classified reimbursements also land as `EXCLUDED`, giving
users a consistent starting point before they set the offset category.

---

## Data Flow: Current vs. Proposed

### Current — CREDIT on import

```
CSV import → LLM classifies credit
  category ∈ ['Transfer', 'Excluded']   → Transaction(CREDIT, EXCLUDED)       [no downstream record]
  category ∈ IncomeSourceEnumType       → Transaction(CREDIT, CONFIRMED)
                                        + IncomeRecord

User opens Ledger → EXCLUDED tab
  → inline category edit → updateCategory mutation
  → category string updated, source = USER_OVERRIDE
  → status stays EXCLUDED regardless of new category
  → MonthlyExpenseSummary untouched (no reimbursement concept)
```

### Proposed — Reimbursement path added

```
CSV import → LLM classifies credit  (unchanged routing)
  category ∈ ['Transfer', 'Excluded', 'Reimbursement']  → Transaction(CREDIT, EXCLUDED)
  category ∈ IncomeSourceEnumType                       → Transaction(CREDIT, CONFIRMED)
                                                        + IncomeRecord

User opens Ledger → Excluded tab → sees EXCLUDED CREDIT row
  → selects "Reimbursement" from category dropdown
  → second "Offsets category" dropdown appears → user picks "Food & Dining"
  → handleCategoryChange(id, 'Reimbursement', 'Food & Dining')
      → trpc.transactionLedger.updateCategory.mutate(
            { id, newCategory: 'Reimbursement', offsetCategory: 'Food & Dining' })
          [server]
          → Transaction.status:         EXCLUDED → CONFIRMED
          → Transaction.category:       'Transfer' → 'Reimbursement'
          → Transaction.offsetCategory: null → 'Food & Dining'
          → Transaction.source:         LLM_CLASSIFIED → USER_OVERRIDE
          → Transaction.confirmedAt:    null → now()
          → applyReimbursementOffset(userId, 'Food & Dining', amount, date)
              → MonthlyExpenseSummary['Food & Dining'][month].amount -= reimbursementAmount
          [client]
          → toast.success('Category updated')
          → refetch() → row re-renders as CONFIRMED / Reimbursement
```

### Reversal — user changes away from Reimbursement

```
User edits CONFIRMED Reimbursement row → selects 'Transfer'
  → handleCategoryChange(id, 'Transfer', undefined)
      → updateCategory.mutate({ id, newCategory: 'Transfer' })
          [server]
          → Transaction.status:         CONFIRMED → EXCLUDED
          → Transaction.category:       'Reimbursement' → 'Transfer'
          → Transaction.offsetCategory: 'Food & Dining' → null
          → reverseReimbursementOffset(userId, 'Food & Dining', amount, date)
              → MonthlyExpenseSummary['Food & Dining'][month].amount += reimbursementAmount
```

### Re-offset — user keeps Reimbursement but changes which category is offset

```
User changes "Offsets category" dropdown from 'Food & Dining' to 'Travel'
  → handleCategoryChange(id, 'Reimbursement', 'Travel')
      → updateCategory.mutate({ id, newCategory: 'Reimbursement', offsetCategory: 'Travel' })
          [server]
          → Transaction.offsetCategory: 'Food & Dining' → 'Travel'
          → reverseReimbursementOffset(userId, 'Food & Dining', amount, date)
          → applyReimbursementOffset(userId, 'Travel', amount, date)
```
