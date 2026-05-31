# Transaction Ledger — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1a** | `transaction-ledger.ts` router, `root.ts` | tRPC `getAll` procedure + register in root |
| **1b** | `TransactionLedgerTable.tsx` | Read-only table — no edit |
| **1c** | `TransactionsClient.tsx`, `CSVImportWizard.tsx` | Wire `refreshKey` → `onImportComplete` |
| **2a** | `transaction-ledger.ts` router, `ledger.service.ts` | `updateCategory` mutation + re-rollup service |
| **2b** | `TransactionRow.tsx` | Inline category edit dropdown |
| **3** | `TransactionFilters.tsx` | Filter bar + optional URL param persistence |

---

## Phase 1a — tRPC Router

**File:** `src/server/api/routers/transaction-ledger.ts`

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { TransactionTypeEnum, TransactionStatusEnum } from '@prisma/client';

const GetAllInputSchema = z.object({
  page:          z.number().int().min(1).default(1),
  limit:         z.number().int().min(1).max(100).default(50),
  type:          z.nativeEnum(TransactionTypeEnum).optional(),
  status:        z.nativeEnum(TransactionStatusEnum).optional(),
  bankAccountId: z.string().optional(),
  dateFrom:      z.string().optional(), // ISO date YYYY-MM-DD
  dateTo:        z.string().optional(),
  search:        z.string().optional(),
  ids:           z.array(z.string()).optional(), // review mode: fetch exactly these IDs, overrides all other filters
});

export type GetAllInput = z.infer<typeof GetAllInputSchema>;

export interface TransactionRow {
  id:              string;
  date:            string;
  description:     string;
  amount:          number;
  type:            TransactionTypeEnum;
  category:        string;
  source:          string;
  status:          TransactionStatusEnum;
  bankAccountId:   string | null;
  bankAccountName: string | null;
  bankName:        string | null;
  importSessionId: string | null;
  createdAt:       string;
}

export interface GetAllOutput {
  transactions:       TransactionRow[];
  total:              number;
  page:               number;
  totalPages:         number;
  expenseCategories:  Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
}
```

Tab-to-params mapping:
```typescript
const TAB_TO_PARAMS: Record<TabFilter, { type?: TransactionTypeEnum; status?: TransactionStatusEnum }> = {
  all:      {},
  expenses: { type: 'DEBIT',  status: 'CONFIRMED' },
  income:   { type: 'CREDIT', status: 'CONFIRMED' },
  excluded: {                  status: 'EXCLUDED'  },
  voided:   {                  status: 'VOIDED'    },
};
```

---

## Phase 1b — TransactionLedgerTable

**File:** `src/components/transactions/TransactionLedgerTable.tsx`

```typescript
interface TransactionLedgerTableProps {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  refreshKey: number; // incremented by parent when import completes
}
```

State:
```typescript
const [activeTab, setActiveTab]          = useState<TabFilter>('all');
const [page, setPage]                    = useState(1);
const [bankAccountId, setBankAccountId]  = useState<string | undefined>();
const [dateFrom, setDateFrom]            = useState<string | undefined>();
const [dateTo, setDateTo]                = useState<string | undefined>();
const [search, setSearch]                = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
```

tRPC query:
```typescript
const { data, isLoading, refetch } = api.transactionLedger.getAll.useQuery({
  page,
  limit: 50,
  ...TAB_TO_PARAMS[activeTab],
  bankAccountId,
  dateFrom,
  dateTo,
  search: debouncedSearch,
});
```

Table columns: Date | Description | Amount | Type | Category | Source | Status | Bank Account

---

## Phase 1c — Integration into TransactionsClient

**File:** `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx`

```typescript
const [refreshKey, setRefreshKey] = useState(0);
const handleImportComplete = useCallback(() => setRefreshKey((k) => k + 1), []);

// Pass to CSVImportWizard:
<CSVImportWizard onImportComplete={handleImportComplete} ... />
// Pass to table:
<TransactionLedgerTable bankAccounts={bankAccounts} refreshKey={refreshKey} />
```

---

## Phase 2a — updateCategory Mutation

Add to `transaction-ledger.ts`:

```typescript
const UpdateCategoryInputSchema = z.object({
  id:              z.string().min(1),
  newCategory:     z.string().min(1),
  applyToMatching: z.boolean().optional(), // default true; pass false during review-batch edits
});

updateCategory: protectedProcedure
  .input(UpdateCategoryInputSchema)
  .mutation(async ({ ctx, input }) => {
    const tx = await ctx.db.transaction.findUnique({ where: { id: input.id } });
    if (!tx || tx.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });

    const updated = await ctx.db.transaction.update({
      where: { id: input.id },
      data: { category: input.newCategory, source: 'USER_OVERRIDE' },
    });

    // Re-rollup for the directly edited transaction
    if (tx.type === 'DEBIT' && tx.status === 'CONFIRMED' && tx.category !== input.newCategory) {
      await rerollupExpenseSummary({ userId: tx.userId, oldCategory: tx.category, newCategory: input.newCategory, amount: tx.amount, date: tx.date });
    }
    if (tx.type === 'CREDIT' && tx.status === 'CONFIRMED' && tx.category !== input.newCategory) {
      await updateIncomeRecordSource({ userId: tx.userId, newSource: input.newCategory as IncomeSourceEnumType, amount: tx.amount, transactionDate: tx.date });
    }

    // Auto-apply to matching transactions (same description, same user, different category)
    // Skipped when applyToMatching is explicitly false (e.g. during review-batch corrections)
    const matchedIds: string[] = [];
    if (input.applyToMatching !== false) {
      const matches = await ctx.db.transaction.findMany({
        where: {
          userId: tx.userId,
          description: tx.description,
          id: { not: tx.id },
          category: { not: input.newCategory }, // only update those that differ
        },
      });

      for (const match of matches) {
        await ctx.db.transaction.update({
          where: { id: match.id },
          data: { category: input.newCategory, source: 'USER_OVERRIDE' },
        });
        if (match.type === 'DEBIT' && match.status === 'CONFIRMED') {
          await rerollupExpenseSummary({ userId: match.userId, oldCategory: match.category, newCategory: input.newCategory, amount: match.amount, date: match.date });
        }
        if (match.type === 'CREDIT' && match.status === 'CONFIRMED') {
          await updateIncomeRecordSource({ userId: match.userId, newSource: input.newCategory as IncomeSourceEnumType, amount: match.amount, transactionDate: match.date });
        }
        matchedIds.push(match.id);
      }
    }

    return { updated, matchedIds };
  }),
```

---

## Phase 2b — Inline Edit in TransactionRow

**File:** `src/components/transactions/TransactionRow.tsx`

Component props:
```typescript
interface TransactionRowProps {
  transaction:        TransactionRow;
  expenseCategories:  Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  isInReviewBatch:    boolean; // true when this row is shown in the review-batch filtered view
  onCategoryChange:   (id: string, newCategory: string, applyToMatching: boolean) => void;
}
```

Inline category edit:
```typescript
<td>
  <select
    value={transaction.category}
    onChange={(e) => onCategoryChange(transaction.id, e.target.value, !isInReviewBatch)}
    className="w-full min-w-[140px] rounded border border-gray-300 bg-transparent px-2 py-1 text-sm
               text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white
               focus:outline-none focus:ring-2 focus:ring-teal-500"
  >
    {transaction.type === 'DEBIT'
      ? expenseCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)
      : incomeSourceLabels.map((l) => <option key={l} value={l}>{l}</option>)
    }
  </select>
</td>
```

Key behavior:
- When `isInReviewBatch` is **false** (normal mode): pass `applyToMatching: true` → triggers bulk auto-apply of matching category to similar descriptions
- When `isInReviewBatch` is **true** (review mode): pass `applyToMatching: false` → updates only that single transaction (no recursion)

---

## Phase 2b Review-Batch State Management

**File:** `src/components/transactions/TransactionLedgerTable.tsx`

Additional state to track review mode:
```typescript
const [reviewBatch, setReviewBatch] = useState<string[] | null>(null);
const [preReviewCategory, setPreReviewCategory] = useState<string | undefined>();
```

`preReviewCategory` saves the active category filter before review mode so it can be restored when the user exits.

On `updateCategory` mutation `onSuccess` when `matchedIds.length > 0`:
```typescript
setPreReviewCategory(category); // save current category filter
setReviewBatch(result.matchedIds);
// queryInput reacts to reviewBatch → adds ids filter → server returns exactly these rows
```

**Why server-side `ids` filter (not client-side):** With infinite scroll pagination, matched transactions may be on page 3+. A client-side `.filter()` on the loaded pages would show "No transactions found" for any match not in the first 50 rows. Passing `ids` to the server ensures exactly those rows are returned regardless of their position.

`queryInput` includes `ids` when in review mode — this overrides all other filters server-side:
```typescript
const queryInput = useMemo(() => ({
  limit: PAGE_SIZE,
  ...TAB_TO_PARAMS[activeTab],
  ...(category ? { category } : {}),
  // ... other filters ...
  ...(reviewBatch !== null ? { ids: reviewBatch } : {}), // overrides everything when in review
}), [...deps, reviewBatch]);
```

`handleExitReview` restores the saved filter:
```typescript
const handleExitReview = useCallback(() => {
  setReviewBatch(null);
  setCategory(preReviewCategory); // restore the filter the user had before review
  setPreReviewCategory(undefined);
}, [preReviewCategory]);
```

Review mode lifecycle:
- **Entered**: `matchedIds.length > 0` on mutation success → save category filter, set `reviewBatch`, `queryInput` gains `ids` filter → server returns exactly the matched rows
- **Exited via button**: "Exit review" banner button → `handleExitReview` → restores saved category filter, clears `reviewBatch`
- **Exited via tab change / reset**: `setReviewBatch(null)` only — no filter restore (user intentionally navigated away)
- **Single edit in review**: passes `applyToMatching: false` → no recursion, only that row updates

**Key design decisions:**
- `reviewBatch` is pure React state — no DB column, no `batchId` persisted anywhere
- Server `ids` filter (`WHERE id IN (...)`) is the reliable way to retrieve specific rows regardless of pagination depth
- Category filter is NOT cleared on enter — the `ids` filter overrides all filters server-side
- `applyToMatching: false` during review prevents recursive auto-apply
- Tab change and reset intentionally do NOT restore the pre-review filter (user navigated away deliberately)


---

## Phase 3 — TransactionFilters

**File:** `src/components/transactions/TransactionFilters.tsx`

```typescript
interface TransactionFiltersProps {
  bankAccounts:    Array<{ id: string; name: string }>;
  bankAccountId:   string | undefined;
  dateFrom:        string | undefined;
  dateTo:          string | undefined;
  search:          string;
  onBankChange:    (id: string | undefined) => void;
  onDateFromChange:(v: string | undefined) => void;
  onDateToChange:  (v: string | undefined) => void;
  onSearchChange:  (v: string) => void;
  onReset:         () => void;
}
```

Controls: bank account `<select>`, date from/to `<input type="date">`, description search (300ms debounce), reset button.

URL param enhancement (optional): persist `?tab=expenses&from=2025-07-01&to=2025-07-31&q=salary` via `useSearchParams` + `router.replace`.

---

## Re-rollup Service

**File:** `src/server/services/transactions/ledger.service.ts`

`rerollupExpenseSummary({ userId, oldCategory, newCategory, amount, date })`:
1. Find fiscal `CalendarYear` and `ExpenseLedger` for the user
2. Find `ExpenseCategory` by name for old and new categories
3. Decrement `MonthlyExpenseSummary` for old category
4. Upsert `MonthlyExpenseSummary` for new category

`updateIncomeRecordSource({ userId, newSource, amount, transactionDate })`:
1. Find `IncomeLedger` for user
2. Find `IncomeRecord` by `(incomeLedgerId, dateEarned, amount)` — best-effort match
3. Update `source` field

---

## Schema Migration (Phase 2 future)

Add `transactionId` FK to `IncomeRecord` for deterministic credit matching:
```prisma
model IncomeRecord {
  transactionId String?     @unique
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
}
```
Migration name: `add_income_record_transaction_fk`

---

## Files

| File | Action | Description |
|---|---|---|
| `src/server/api/routers/transaction-ledger.ts` | CREATE | `getAll` + `updateCategory` tRPC procedures |
| `src/components/transactions/TransactionLedgerTable.tsx` | CREATE | Main ledger table with tabs, filters, pagination |
| `src/components/transactions/TransactionFilters.tsx` | CREATE | Filter bar component |
| `src/components/transactions/TransactionRow.tsx` | CREATE | Single row with inline category `<select>` |
| `src/server/services/transactions/ledger.service.ts` | CREATE | `rerollupExpenseSummary`, `updateIncomeRecordSource` |
| `src/server/api/root.ts` | MODIFY | Register `transactionLedger` router |
| `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx` | MODIFY | Add ledger table + `refreshKey` + `handleImportComplete` |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx` | MODIFY | Call `onImportComplete` on wizard close after confirm |
