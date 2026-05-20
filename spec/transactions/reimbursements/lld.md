# Reimbursement Tracking — Low Level Design

## Overview

Reimbursements are CREDIT transactions where someone pays the user back for a shared expense. This feature adds `offsetCategory` to `Transaction` to track which expense category a reimbursement offsets, and applies roll-up offsets to `MonthlyExpenseSummary`.

Phase 1 (complete): Category-based offset with `offsetCategory` field.  
Phase 2 (optional): Transaction-to-transaction linking via `offsetTransactionId` FK.

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
    
    // Validation: Reimbursement only on CREDIT + EXCLUDED
    if (newCategory === REIMBURSEMENT_CATEGORY) {
      if (transaction.type !== 'CREDIT') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Reimbursement only valid for CREDIT' });
      if (transaction.status === 'CONFIRMED' && transaction.category !== REIMBURSEMENT_CATEGORY) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot reclassify CONFIRMED income as Reimbursement' });
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

1. ✅ User can set `category = Reimbursement` on CREDIT+EXCLUDED rows
2. ✅ Offset-category dropdown appears when Reimbursement is selected
3. ✅ Transaction status promotes to CONFIRMED when Reimbursement is assigned
4. ✅ `MonthlyExpenseSummary` for offset category decrements by reimbursement amount
5. ✅ Changing away from Reimbursement reverts status to EXCLUDED and restores MonthlyExpenseSummary
6. ✅ "Reimbursement" option does NOT appear in DEBIT or CONFIRMED CREDIT dropdowns
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
  }))
  .query(async ({ input, ctx }) => {
    const { search, limit } = input;
    return ctx.prisma.transaction.findMany({
      where: {
        userId: ctx.session.user.id,
        type: 'DEBIT',
        status: 'CONFIRMED',
        description: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      select: { id: true, date: true, description: true, amount: true, category: true },
      take: limit,
    });
  }),
```

### 2.3 Component: Link to Expense

**File:** `src/components/transactions/TransactionRow.tsx` (Phase 2 update)

Return `React.Fragment` and add sub-row accordion + link combobox (see spec HLD for full details).

### 2.4 Component: ReimbursementSubRow

**File:** `src/components/transactions/ReimbursementSubRow.tsx` (new file)

Presentation-only sub-row showing linked reimbursements with ↩ badge and teal background.

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

### Phase 2 (Optional)

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add offsetTransactionId FK, offsetTransaction relation, reimbursements array |
| `src/server/trpc/router/transaction-ledger.ts` | MODIFY | Add searchDebitTransactions query, extend updateCategory with offsetTransactionId validation |
| `src/components/transactions/TransactionRow.tsx` | MODIFY | Return Fragment, add accordion for DEBIT rows, add link combobox for Reimbursement rows |
| `src/components/transactions/TransactionLedgerTable.tsx` | MODIFY | Add accordion chevron column, extend handleCategoryChange |
| `src/components/transactions/ReimbursementSubRow.tsx` | CREATE | Sub-row component for linked reimbursements |
