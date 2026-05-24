# Manual Expense Entry via Transaction Record — LLD

## Data Layer Changes

### New server action: `addExpenseRow`

Replace `addRow` in `src/app/(authorized)/cashflow/expense/actions.ts`:

```typescript
// Creates a Transaction record, not a MonthlyExpenseSummary entry
export async function addExpenseRow(calendarYearId: string, month: number, data: {
  categoryName: string;
  amount: number;
}): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session?.user?.id) return { success: false, error: 'Unauthenticated' };

  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return { success: false, error: 'Calendar year not found' };

  const year = month >= calendarYear.fromMonth ? calendarYear.fromYear : calendarYear.toYear;
  const date = new Date(year, month - 1, 1); // first day of month

  await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type: 'DEBIT',
      status: 'CONFIRMED',
      source: 'USER_MANUAL',
      category: data.categoryName,
      amount: data.amount,
      date,
      description: `Manual expense: ${data.categoryName}`,
    },
  });

  revalidatePath('/cashflow/expense');
  return { success: true };
}
```

### New server action: `editExpenseRow`

Updates amount and category of a USER_MANUAL transaction. Guard: reject if `source !== 'USER_MANUAL'`.

```typescript
export async function editExpenseRow(transactionId: string, data: {
  categoryName: string;
  amount: number;
}): Promise<ActionResult> {
  const session = await getAuthSession();
  // ... ownership + source=USER_MANUAL guard ...
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { category: data.categoryName, amount: data.amount },
  });
  revalidatePath('/cashflow/expense');
  return { success: true };
}
```

### New server action: `deleteExpenseRow`

Voids the transaction (sets status=VOIDED). Guard: reject if `source !== 'USER_MANUAL'`.

```typescript
export async function deleteExpenseRow(transactionId: string): Promise<ActionResult> {
  const session = await getAuthSession();
  // ... ownership + source=USER_MANUAL guard ...
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: 'VOIDED' },
  });
  revalidatePath('/cashflow/expense');
  return { success: true };
}
```

## Service Layer Changes

### `getExpenseEntriesForMonth` in `expense.service.ts`

Add `source` and `transactionId` to the returned shape so the UI can:
1. Show Edit/Delete only for `source === 'USER_MANUAL'` entries
2. Pass the correct `transactionId` to `editExpenseRow`/`deleteExpenseRow`

```typescript
// Change Transaction query to include source and id:
const transactions = await prisma.transaction.findMany({
  where: { userId, type: 'DEBIT', status: 'CONFIRMED', date: { gte, lte } },
  select: { id: true, category: true, amount: true, source: true },
});

// Aggregation: group by (category, source)
// For USER_MANUAL: keep individual transaction IDs
// For bank-imported: aggregate as before (single synthetic entry per category)
```

**Return shape addition** (update `ExpenseEntryModel` in `src/server/models/expense.ts`):
```typescript
export type ExpenseEntryModel = {
  id: string;                          // transactionId for USER_MANUAL; categoryId for bank-imported
  month: number;
  amount: number;
  categoryId: string;
  expenseLedgerId: string;             // '' = transaction-derived (sentinel)
  source?: 'USER_MANUAL' | 'bank';    // new field
  categoryName?: string;
  importImageId?: string | null;
  importImage?: { id: string; fileName: string } | null;
};
```

## UI Changes

### `CategoryBreakdownModal.tsx`

1. **`readOnly` detection** — change from "all entries are read-only" to per-entry logic:
   - Entry `source === 'USER_MANUAL'`: show Edit/Delete
   - Entry `source !== 'USER_MANUAL'` (bank-imported): show read-only (no Edit/Delete)
   - "Add New Expense" form: always visible (creates USER_MANUAL transaction)

2. **Edit flow** — `editEntryId` stores `transaction.id` (not category ID); `editExpenseRow` receives the real transaction ID

3. **Delete flow** — calls `deleteExpenseRow(entry.id)` where `entry.id` is the transaction ID for USER_MANUAL entries

4. **Info tooltip/badge** — bank-imported entries get a lock icon or "Bank import" badge to communicate read-only status to the user

## Schema Changes

No migrations needed — `Transaction` table already has `source` field. Verify `source` enum includes `USER_MANUAL`; if not, add it:

```sql
-- Check existing enum values:
SELECT unnest(enum_range(NULL::transaction_source_enum));
-- If USER_MANUAL missing: ALTER TYPE transaction_source_enum ADD VALUE 'USER_MANUAL';
```

Migration name suggestion: `add-user-manual-transaction-source` (if needed).

## Acceptance Criteria

1. User opens Expenses modal for July 2024 → Add New Expense form is visible
2. User adds a $500 "Groceries" expense → new Transaction appears in Transaction Ledger with type=DEBIT, status=CONFIRMED, source=USER_MANUAL
3. July 2024 total on Expenses page updates immediately (via `revalidatePath`)
4. Edit button visible only for USER_MANUAL entries; Edit updates the Transaction record
5. Delete button visible only for USER_MANUAL entries; Delete sets status=VOIDED (appears in ledger as VOIDED, not in DEBIT+CONFIRMED expenses)
6. Bank-imported entries show no Edit/Delete; lock icon or "Bank import" label visible
7. No regression: Expenses page total matches Transaction Ledger "Expenses" tab total
