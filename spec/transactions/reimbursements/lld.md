# Reimbursement Tracking — Low Level Design

## Overview

Reimbursements are transactions involving a third party — either money you paid on behalf of someone else (DEBIT, awaiting payback) or money received back for an expense you fronted (CREDIT, offsets an expense category). This feature adds `offsetCategory` to `Transaction` to track which expense category a reimbursement CREDIT offsets, and applies roll-up adjustments to `MonthlyExpenseSummary`.

- **DEBIT + Reimbursement**: excluded from expense roll-ups while awaiting payback (similar to Transfer status but retains Reimbursement discriminator for reporting)
- **CREDIT + Reimbursement**: promoted to CONFIRMED; decrements `MonthlyExpenseSummary` for the named `offsetCategory`

Phase 1 (complete): Category-based offset with `offsetCategory` field.  
Phase 2 (optional): Transaction-to-transaction linking via `offsetTransactionId` FK; `offsetCategory` auto-derived from linked debit's category — user does not need to choose it manually.

---

## Phase 1: Category-Based Reimbursement Offset

### 1.1 Data Model Changes

**File:** `prisma/schema.prisma`

Add nullable `offsetCategory` field to `Transaction` model:

```prisma
model Transaction {
  // ... all existing fields ...
  offsetCategory  String?   // non-null only when category = 'Reimbursement'
}
```

Migration:
```bash
pnpm prisma migrate dev --name add_transaction_offset_category
```

### 1.2 Constants Definition

**File:** `src/server/services/transactions/constants.ts` (new file)

```typescript
export const REIMBURSEMENT_CATEGORY = 'Reimbursement' as const;

export const EXCLUDED_CREDIT_LABELS = [
  'Transfer',
  'Excluded',
  'Reimbursement',
] as const;
```

### 1.3 Ledger Service Updates

**File:** `src/server/services/transactions/ledger.service.ts`

Add two new functions:

```typescript
/**
 * Decrement MonthlyExpenseSummary for offsetCategory when a reimbursement is assigned.
 */
export async function applyReimbursementOffset(params: {
  prismaClient: PrismaClient;
  userId: string;
  offsetCategory: string;
  amount: Decimal;
  transactionDate: Date;
}): Promise<void> {
  const { prismaClient, userId, offsetCategory, amount, transactionDate } = params;
  
  // Lookup: Fiscal CalendarYear → ExpenseLedger → MonthlyExpenseSummary for offsetCategory
  // Decrement amount by reimbursement
  // May result in negative amounts (intentional — auditable)
}

/**
 * Increment MonthlyExpenseSummary when a reimbursement is removed or re-offset.
 */
export async function reverseReimbursementOffset(params: {
  prismaClient: PrismaClient;
  userId: string;
  offsetCategory: string;
  amount: Decimal;
  transactionDate: Date;
}): Promise<void> {
  // Inverse of applyReimbursementOffset
}
```

Reuse existing `rerollupExpenseSummary` pattern:
```
Lookup: Fiscal CalendarYear → ExpenseLedger(calendarId+userId) →
  ExpenseCategory by name → updateMany(decrement old) + upsert(increment new)
```

### 1.4 tRPC Router Updates

**File:** `src/server/trpc/router/transaction-ledger.ts`

#### Extend `updateCategorySchema`:

```typescript
const updateCategorySchema = z.object({
  id: z.string(),
  newCategory: z.string(),
  offsetCategory: z.string().optional(),
}).refine(
  (data) => data.newCategory !== REIMBURSEMENT_CATEGORY || data.offsetCategory,
  {
    message: 'offsetCategory required when category is Reimbursement',
    path: ['offsetCategory'],
  }
);
```

#### Extend `updateCategory` mutation:

```typescript
updateCategory: protectedProcedure
  .input(updateCategorySchema)
  .mutation(async ({ input, ctx }) => {
    const { id, newCategory, offsetCategory } = input;
    const transaction = await ctx.prisma.transaction.findUnique({
      where: { id },
    });
    
    if (!transaction || transaction.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
    
    // Validation: Reimbursement allowed on DEBIT or CREDIT transactions
    // - DEBIT + Reimbursement: excluded from expense roll-ups (awaiting payback)
    // - CREDIT + Reimbursement: requires offsetCategory; decrements MonthlyExpenseSummary
    //
    // ⚠️ DO NOT add a guard blocking CONFIRMED CREDITs from becoming Reimbursement.
    // All bank-imported CREDITs are auto-confirmed — such a guard blocks all real-world use.
    // UI visibility (showReimbursementOption) is the appropriate access control layer.
    if (newCategory === REIMBURSEMENT_CATEGORY) {
      if (transaction.type === 'CREDIT' && !offsetCategory) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'offsetCategory required when assigning Reimbursement to a CREDIT' });
      }
    }
    
    // Promotion/demotion logic
    const oldCategory = transaction.category;
    const oldStatus = transaction.status;
    const newStatus = newCategory === REIMBURSEMENT_CATEGORY ? 'CONFIRMED' : 'EXCLUDED';
    
    // Reverse old offset if exists
    if (oldCategory === REIMBURSEMENT_CATEGORY && transaction.offsetCategory) {
      await reverseReimbursementOffset({
        prismaClient: ctx.prisma,
        userId: ctx.session.user.id,
        offsetCategory: transaction.offsetCategory,
        amount: transaction.amount,
        transactionDate: transaction.date,
      });
    }
    
    // Apply new offset if reimbursement
    if (newCategory === REIMBURSEMENT_CATEGORY) {
      await applyReimbursementOffset({
        prismaClient: ctx.prisma,
        userId: ctx.session.user.id,
        offsetCategory: offsetCategory!,
        amount: transaction.amount,
        transactionDate: transaction.date,
      });
    }
    
    // Update transaction
    await ctx.prisma.transaction.update({
      where: { id },
      data: {
        category: newCategory,
        offsetCategory: newCategory === REIMBURSEMENT_CATEGORY ? offsetCategory : null,
        status: newStatus,
        source: 'USER_OVERRIDE',
        confirmedAt: newStatus === 'CONFIRMED' ? new Date() : null,
      },
    });
  }),
```

#### Extend `TransactionRow` interface:

```typescript
interface TransactionRow {
  // ... existing fields ...
  offsetCategory: string | null;
}
```

#### Extend `getAll` query map:

```typescript
return {
  // ... existing fields ...
  offsetCategory: tx.offsetCategory ?? null,
};
```

#### Add filter toggle for reimbursements-only ledger view:

```typescript
const getAllInputSchema = z.object({
  // ... existing fields ...
  reimbursementsOnly: z.boolean().optional(),
});

// In query: if (reimbursementsOnly) add WHERE category = REIMBURSEMENT_CATEGORY
```

### 1.5 CSV Confirm Service Update

**File:** `src/server/services/transactions/csv-confirm.service.ts`

Update import and usage:

```typescript
import { EXCLUDED_CREDIT_LABELS } from './constants';

// Change line 13 from:
// const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded'];
// to:
// const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded', 'Reimbursement'];  // from constants
```

### 1.6 Component Updates

**File:** `src/components/transactions/TransactionRow.tsx`

Add conditional "Reimbursement" option and offset-category select:

```typescript
const [localCategory, setLocalCategory] = useState(transaction.category);
const [localOffsetCategory, setLocalOffsetCategory] = useState(transaction.offsetCategory ?? '');

useEffect(() => {
  setLocalCategory(transaction.category);
  setLocalOffsetCategory(transaction.offsetCategory ?? '');
}, [transaction.category, transaction.offsetCategory]);

// In render:
{transaction.type === 'CREDIT' && transaction.status === 'EXCLUDED' && (
  <select
    value={localCategory}
    onChange={(e) => {
      setLocalCategory(e.target.value);
      onCategoryChange(transaction.id, e.target.value, localOffsetCategory || undefined);
    }}
  >
    <option value={REIMBURSEMENT_CATEGORY}>Reimbursement</option>
    {/* ... other categories ... */}
  </select>
)}

{localCategory === REIMBURSEMENT_CATEGORY && (
  <select
    value={localOffsetCategory}
    onChange={(e) => {
      setLocalOffsetCategory(e.target.value);
      onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, e.target.value);
    }}
  >
    <option value="">Select category offset...</option>
    {expenseCategories.map((cat) => (
      <option key={cat} value={cat}>{cat}</option>
    ))}
  </select>
)}
```

**File:** `src/components/transactions/TransactionLedgerTable.tsx`

Extend callback signature and pass through:

```typescript
const handleCategoryChange = (
  id: string,
  newCategory: string,
  offsetCategory?: string,
) => {
  updateCategoryMutation.mutate({
    id,
    newCategory,
    offsetCategory,
  });
};
```

---

## Phase 1 Success Criteria

1. ✅ User can set `category = Reimbursement` on both DEBIT and CREDIT+EXCLUDED rows
2. ✅ CREDIT + Reimbursement: offset-category dropdown appears and is required
3. ✅ DEBIT + Reimbursement: transaction excluded from expense roll-ups (awaiting payback); no offsetCategory required
4. ✅ CREDIT + Reimbursement: transaction status promotes to CONFIRMED; `MonthlyExpenseSummary` for offset category decrements by reimbursement amount
5. ✅ Changing away from Reimbursement reverts CREDIT to EXCLUDED and restores MonthlyExpenseSummary
6. ✅ "Reimbursement" option does NOT appear on CONFIRMED CREDIT rows that are classified as Income
7. ✅ `pnpm run build` passes with no errors

---

## Phase 2 (Optional): Transaction-to-Transaction Linking

### 2.1 Data Model: Self-Referential FK

**File:** `prisma/schema.prisma`

```prisma
model Transaction {
  // ... all existing fields including offsetCategory ...
  offsetTransactionId String?
  offsetTransaction   Transaction?   @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements      Transaction[]  @relation("ReimbursementLink")
}
```

### 2.2 tRPC: Search Debit Transactions

Add new query:

```typescript
searchDebitTransactions: protectedProcedure
  .input(z.object({
    search: z.string().optional(),
    limit: z.number().default(10).max(20),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }))
  .query(async ({ input, ctx }) => {
    return ctx.prisma.transaction.findMany({
      where: {
        userId: ctx.session.user.id,
        type: 'DEBIT',
        // Include CONFIRMED expenses AND EXCLUDED DEBITs already marked as Reimbursement (awaiting payback).
        // DO NOT use status: { in: ['CONFIRMED', 'EXCLUDED'] } — this allows Transfer DEBITs which
        // fail the offsetTransactionId validation and confuse users.
        OR: [
          { status: 'CONFIRMED' },
          { status: 'EXCLUDED', category: REIMBURSEMENT_CATEGORY },
        ],
        reimbursements: { none: {} }, // ⚠️ Phase 3 gap: hides DEBITs with any reimbursement — see Known Limitations in context.md
        description: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      select: { id: true, date: true, description: true, amount: true, category: true },
      take: limit,
    });
  }),
```

**Filter rationale:** `reimbursements: { none: {} }` is correct — NOT `offsetTransactionId: null`.  
`offsetTransactionId` is the FK on **CREDIT** rows (pointing TO the DEBIT). DEBIT rows always have `offsetTransactionId = null`, so filtering on it is a no-op. The back-relation `reimbursements` is the correct field to check on the DEBIT side.

**EXCLUDED Reimbursement DEBITs must appear in search** so the CREDIT payback can link to them.  
The `offsetTransactionId` validation must correspondingly allow `status = EXCLUDED` when `category = REIMBURSEMENT_CATEGORY`.

**Note:** When the user selects a DEBIT to link, `offsetCategory` is **auto-derived** from `linkedDebit.category` — the user does not choose it manually. The `LinkOption` type must include a `category` field so `handleLinkTransaction` can derive `offsetCategory` without requiring the user to select it first. Firing the mutation before `offsetCategory` is resolved will throw `BAD_REQUEST`.

### 2.3 Component: Link to Expense

**File:** `src/components/transactions/TransactionRow.tsx` (Phase 2 update)

Return `React.Fragment` and add sub-row accordion + link combobox (see spec HLD for full details).

### 2.4 Component: ReimbursementSubRow

**File:** `src/components/transactions/ReimbursementSubRow.tsx` (new file)

Presentation-only sub-row showing linked reimbursements with ↩ badge and teal background.

---

## Phase 3 (Optional): Partial Reimbursements

Allows a single DEBIT to have **multiple** CREDIT reimbursements — e.g., a $90 group dinner split with three friends ($30 each).

The data model already supports this (N:1 via `reimbursements Transaction[] @relation`). Only the search filter and UI need updating.

### 3.1 tRPC: Relax `searchDebitTransactions` filter

**File:** `src/server/trpc/router/transaction-ledger.ts`

Remove `reimbursements: { none: {} }` and instead return available DEBITs with partial reimbursement metadata so the UI can show remaining balance:

```typescript
where: {
  userId: ctx.session.user.id,
  type: 'DEBIT',
  status: { in: ['CONFIRMED', 'EXCLUDED'] },
  // No reimbursements filter — allow partially-reimbursed DEBITs
},
select: {
  id: true,
  date: true,
  description: true,
  amount: true,
  category: true,
  reimbursements: {
    where: { category: 'Reimbursement' },
    select: { amount: true },
  },
},
```

Return the total already-reimbursed and remaining:
```typescript
return transactions.map((tx) => ({
  id: tx.id,
  date: ...,
  description: tx.description,
  amount: Number(tx.amount),
  category: tx.category,
  alreadyReimbursed: tx.reimbursements.reduce((sum, r) => sum + Number(r.amount), 0),
  remaining: Number(tx.amount) - tx.reimbursements.reduce((sum, r) => sum + Number(r.amount), 0),
}));
```

### 3.2 UI: Show partial reimbursement state in search results

**File:** `src/components/transactions/TransactionRow.tsx`

Update `formatOptionLabel` in the AsyncSelect to show remaining balance:
```
Netflix.com Melbourne  ·  2025-06-24 · $33.98 Entertainment  ·  $15.49 remaining
```

Add a warning in the option label if `remaining <= 0` (over-reimbursed):
```
⚠️ Fully reimbursed — $0.00 remaining
```

### 3.3 Guard: Prevent over-reimbursement

**File:** `src/server/trpc/router/transaction-ledger.ts`

In `updateCategory` mutation, when `offsetTransactionId` is provided, validate that the new reimbursement amount does not push the DEBIT's total above its original amount:

```typescript
const linked = await ctx.prisma.transaction.findUnique({
  where: { id: input.offsetTransactionId },
  include: { reimbursements: { select: { amount: true } } },
});
const alreadyReimbursed = linked.reimbursements.reduce((sum, r) => sum.add(r.amount), new Decimal(0));
if (alreadyReimbursed.add(transaction.amount).gt(linked.amount)) {
  // warn but don't block — over-reimbursement is auditable
}
```

### 3.4 Success Criteria

1. ✅ A DEBIT with an existing reimbursement still appears in the link search picker
2. ✅ Each search result shows `alreadyReimbursed` and `remaining` amounts
3. ✅ Over-reimbursement (total CREDITs > DEBIT amount) shows a warning badge but is not blocked
4. ✅ DEBIT row `net amount` reflects the sum of ALL linked reimbursements

---

## File Inventory

### Phase 1 (Complete)

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `offsetCategory String?` to Transaction |
| `src/server/services/transactions/constants.ts` | CREATE | Export REIMBURSEMENT_CATEGORY, EXCLUDED_CREDIT_LABELS |
| `src/server/services/transactions/ledger.service.ts` | MODIFY | Add applyReimbursementOffset, reverseReimbursementOffset functions |
| `src/server/services/transactions/csv-confirm.service.ts` | MODIFY | Import EXCLUDED_CREDIT_LABELS from constants (adds 'Reimbursement') |
| `src/server/trpc/router/transaction-ledger.ts` | MODIFY | Extend updateCategorySchema, updateCategory mutation, TransactionRow interface, getAll map |
| `src/components/transactions/TransactionRow.tsx` | MODIFY | Add Reimbursement option, offset-category select, localOffsetCategory state |
| `src/components/transactions/TransactionLedgerTable.tsx` | MODIFY | Extend handleCategoryChange signature, add "reimbursements" tab |

### Phase 3 (Optional — Partial Reimbursements)

| File | Action | Description |
|---|---|---|
| `src/server/trpc/router/transaction-ledger.ts` | MODIFY | Remove `reimbursements: { none: {} }` filter; return `alreadyReimbursed` + `remaining` in search results; add over-reimbursement guard in `updateCategory` |
| `src/components/transactions/TransactionRow.tsx` | MODIFY | Update `formatOptionLabel` to show remaining balance; add "fully reimbursed" warning in picker |
