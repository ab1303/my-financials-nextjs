# Income Source of Truth — Low-Level Design

## 1. Unified Income Entry Contract

All income entries share a single `IncomeEntryModel` with an `origin` discriminator:

```ts
export type IncomeEntryModel = {
  id: string;
  date: Date;                              // transaction date or dateEarned
  amount: number;
  category: string;                        // income source name (Salary, Freelance, etc.)
  source: 'BANK' | 'LLM_CLASSIFIED' | 'MANUAL';  // origin discriminator
  bankAccountId: string | null;            // null for MANUAL
  status: 'CONFIRMED' | 'VOIDED' | ...;    // transaction status
};
```

All fields exist on `Transaction`. No separate `IncomeRecord` type needed.

---

## 2. Schema Changes

### Remove `IncomeRecord` and `IncomeLedger` (after migration)

```prisma
// After data migration, these are deleted:
// - DROP TABLE IncomeRecord
// - DROP TABLE IncomeLedger
// - REMOVE incomeRecord relation from Transaction
```

Income is now queried directly from `Transaction`.

### Keep `IncomeSource` as vocabulary

`IncomeSource` remains unchanged — it's a category/taxonomy lookup, not a container:

```prisma
model IncomeSource {
  id          String @id @default(cuid())
  name        String @unique
  description String?
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  // No relations — purely a vocabulary
}
```

---

## 3. Service Layer Changes

### `income.service.ts` — `getIncomeEntries`

```ts
export const getIncomeEntries = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
  prismaClient = prisma,
): Promise<Array<IncomeEntryModel>> => {
  const calendarYear = await prismaClient.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return [];

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const entries = await prismaClient.transaction.findMany({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      category: { notIn: ['Transfer', 'Reimbursement'] }, // Transfers are pass-through; Reimbursements are expense offsets, not earned income
      date: { gte: startDate, lte: endDate },
      ...(bankAccountId && { bankAccountId }),  // optional bank filter
    },
    select: {
      id: true,
      date: true,
      amount: true,
      category: true,
      source: true,
      bankAccountId: true,
    },
    orderBy: { date: 'desc' },
  });

  return entries.map((tx) => ({
    id: tx.id,
    date: tx.date,
    amount: tx.amount.toNumber(),
    category: tx.category,  // income source name as a string
    source: tx.source as 'BANK' | 'LLM_CLASSIFIED' | 'MANUAL',
    bankAccountId: tx.bankAccountId,
    status: 'CONFIRMED',
  }));
};
```

### `getTotalIncome`

```ts
export const getTotalIncome = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
): Promise<number> => {
  const calendarYear = await prismaClient.calendarYear.findUnique({
    where: { id: calendarYearId },
    select: { fromYear: true, fromMonth: true, toYear: true, toMonth: true },
  });
  if (!calendarYear) return 0;

  const startDate = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
  const endDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59, 999);

  const result = await prismaClient.transaction.aggregate({
    where: {
      userId,
      type: 'CREDIT',
      status: 'CONFIRMED',
      category: { notIn: ['Transfer', 'Reimbursement'] }, // exclude transfer-classified credits and expense-offset reimbursements
      date: { gte: startDate, lte: endDate },
      ...(bankAccountId && { bankAccountId }),
    },
    _sum: { amount: true },
  });

  return (result._sum?.amount || 0).toNumber();
};
```

### `addIncomeEntry` (new - creates a CREDIT transaction)

```ts
export const addIncomeEntry = async (
  userId: string,
  entry: {
    dateEarned: Date;
    amount: number;
    category: string;  // income source name
    incomeLedgerId?: string;  // ignored now, kept for compat
  },
  prismaClient = prisma,
) => {
  const createdEntry = await prismaClient.transaction.create({
    data: {
      userId,
      type: 'CREDIT',
      source: 'MANUAL',
      status: 'CONFIRMED',
      date: entry.dateEarned,
      amount: entry.amount,
      category: entry.category,
      description: `Manual income: ${entry.category}`,
      bankAccountId: null,  // no bank for manual entries
      importSessionId: null,
    },
  });

  return {
    id: createdEntry.id,
    date: createdEntry.date,
    amount: createdEntry.amount.toNumber(),
    category: createdEntry.category,
    source: createdEntry.source,
    bankAccountId: null,
  };
};
```

### `updateIncomeEntry` → only allow MANUAL source

```ts
export const updateIncomeEntry = async (
  entryId: string,
  entry: { dateEarned: Date; amount: number; category: string },
  prismaClient = prisma,
) => {
  const existing = await prismaClient.transaction.findUnique({
    where: { id: entryId },
    select: { source: true },
  });
  if (existing?.source !== 'MANUAL') {
    throw new Error('Cannot edit imported income. Only manual entries can be modified.');
  }

  await prismaClient.transaction.update({
    where: { id: entryId },
    data: {
      date: entry.dateEarned,
      amount: entry.amount,
      category: entry.category,
    },
  });
};
```

### `deleteIncomeEntry` → only allow MANUAL source

```ts
export const deleteIncomeEntry = async (
  entryId: string,
  prismaClient = prisma,
) => {
  const existing = await prismaClient.transaction.findUnique({
    where: { id: entryId },
    select: { source: true },
  });
  if (existing?.source !== 'MANUAL') {
    throw new Error('Cannot delete imported income. Only manual entries can be deleted.');
  }

  await prismaClient.transaction.delete({ where: { id: entryId } });
};
```

### `csv-confirm.service.ts` — simplify `confirmCreditTransactions`

Remove the `IncomeRecord` creation block entirely. The Transaction alone is the income record:

```ts
// REMOVE this block:
// const incomeLedger = await getOrCreateIncomeLedger(calendarYear.id, userId);
// await prisma.incomeRecord.create({ ... });

// KEEP only:
await createTransactionRecord({
  date: tx.date,
  description: tx.description,
  amount: tx.amount,
  type: TransactionTypeEnum.CREDIT,
  category: tx.confirmedCategory,
  source: tx.overridden ? TransactionSourceEnum.USER_OVERRIDE : TransactionSourceEnum.LLM_CLASSIFIED,
  status: TransactionStatusEnum.CONFIRMED,
  userId,
  bankAccountId,
  importSessionId,
  runningBalance: tx.balance,
});
```

No secondary income record creation.

### `void.service.ts` — remove income-specific logic

Delete these functions entirely:
- `reverseIncomeRecord()`
- `reapplyIncomeRecord()`

Remove from `reverseDownstream()`:
- The `incomeRecord: true` include in the Transaction query
- The `tx.incomeRecord?.id` reference

Reason: Voiding a CREDIT transaction sets `status = 'VOIDED'`, which automatically excludes it from `getIncomeEntries` (query filters `status = 'CONFIRMED'`).

---

## 4. UI Type Changes

### `IncomeEntryType` (renamed from mixed model)

```ts
export type IncomeEntryType = {
  id: string;
  dateEarned: Date;
  amount: number;
  incomeSourceName: string;  // category string from Transaction
  source: 'BANK' | 'LLM_CLASSIFIED' | 'MANUAL';  // origin discriminator
  bankAccountId: string | null;
};
```

### Read-only logic in `columns.tsx`

```ts
cell: (props) => {
  if (props.row.original.source !== 'MANUAL') {
    return <LockIcon title="Imported transaction — read-only" />;
  }
  return <EditCell {...props} />;
},
```

---

## 5. Data Migration

**Step 1: Delete linked IncomeRecords** (those with `transactionId` set after band-aid fix)
```sql
DELETE FROM IncomeRecord WHERE transactionId IS NOT NULL;
```

**Step 2: Convert remaining IncomeRecord rows to Transaction**
```sql
-- Remaining manual IncomeRecord rows → create CREDIT/MANUAL transactions
INSERT INTO Transaction (
  userId, type, source, status, date, amount, category, 
  description, bankAccountId, importSessionId, confirmedAt
)
SELECT 
  il.userId, 'CREDIT', 'MANUAL', 'CONFIRMED', 
  ir.dateEarned, ir.amount, 
  COALESCE(isco.name, 'Income'), 
  CONCAT('Manual income: ', COALESCE(isco.name, 'Income')),
  NULL, NULL, NOW()
FROM IncomeRecord ir
JOIN IncomeLedger il ON ir.incomeLedgerId = il.id
LEFT JOIN IncomeSource isco ON ir.incomeSourceId = isco.id;

-- Delete migrated rows
DELETE FROM IncomeRecord;
DELETE FROM IncomeLedger;
```

**Step 3: Drop tables** (run as a Prisma migration after code is deployed)
```sql
DROP TABLE IncomeRecord;
DROP TABLE IncomeLedger;
```

---

## 6. File Inventory

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `IncomeRecord` and `IncomeLedger` models; remove `incomeRecord` relation from `Transaction` |
| `src/server/models/income.ts` | Update `IncomeEntryModel` to use `source` discriminator instead of `transactionId`; remove `incomeLedgerId` |
| `src/server/services/income.service.ts` | Rewrite `getIncomeEntries`, `getTotalIncome`, `addIncomeEntry`, `updateIncomeEntry`, `deleteIncomeEntry` to use Transaction table directly |
| `src/server/services/transactions/csv-confirm.service.ts` | Remove `IncomeRecord` creation block; remove `getOrCreateIncomeLedger` call |
| `src/server/services/transactions/void.service.ts` | Remove `reverseIncomeRecord`, `reapplyIncomeRecord` functions; remove `incomeRecord` includes |
| `src/app/(authorized)/cashflow/income/_types.ts` | Replace `transactionId` with `source` discriminator |
| `src/app/(authorized)/cashflow/income/_table/columns.tsx` | Update lock condition: `source !== 'MANUAL'` |
| `src/app/(authorized)/cashflow/income/actions.ts` | Update `addRow` to work with new `addIncomeEntry` signature |
| `src/app/(authorized)/cashflow/income/_components/MonthAccordionPanel.tsx` | Update new row defaults: `source: 'MANUAL'` |
| `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx` | Update new row defaults |
| `src/app/(authorized)/cashflow/income/IncomeTableServer.tsx` | Pass `source` instead of `transactionId` |

---

## 7. Acceptance Criteria

- [ ] Importing a CSV with CREDIT transactions creates **only** Transaction rows (no IncomeRecord)
- [ ] Income Tracking page shows all CREDIT+CONFIRMED transactions for the selected fiscal year
- [ ] Manual income entries are created as `Transaction(type=CREDIT, source=MANUAL)`
- [ ] Manually added rows show edit/delete buttons; imported rows show a 🔒 lock icon
- [ ] Voiding a CREDIT transaction removes it from the Income Tracking view immediately
- [ ] Restoring a voided CREDIT transaction restores it to the Income Tracking view
- [ ] `IncomeRecord` and `IncomeLedger` tables no longer exist
- [ ] Bank filter only filters CREDIT transactions; works independently
- [ ] Total income equals sum of all CREDIT+CONFIRMED transactions in the fiscal year, **excluding** `category IN ('Transfer', 'Reimbursement')`
- [ ] Reimbursements (split payment returns) do **not** appear in income totals or the source breakdown bar
- [ ] Transfer-categorised CREDITs do **not** appear in income totals
- [ ] TypeScript compiles with zero errors on income-related source files

