# Reimbursement Tracking — Low Level Design

**Version:** 1.0
**Status:** Implementation-Ready
**Reference:** `hld.md` for architecture decisions; `context.md` for file inventory and data flows

---

## Phase Map

```
Phase 1 — Schema migration        (prisma/schema.prisma)                    ← COMPLETE
Phase 2 — Constants + service     (constants.ts + ledger.service.ts)         ← COMPLETE
Phase 3 — tRPC router changes     (transaction-ledger.ts)                    ← COMPLETE
Phase 4 — UI changes              (TransactionRow + TransactionLedgerTable)  ← COMPLETE
Phase 5 — Schema: link FK         (prisma/schema.prisma)                     ← SPECCED
Phase 6 — Router: link support    (transaction-ledger.ts)                    ← SPECCED
Phase 7 — UI: accordion + picker  (ReimbursementSubRow + TransactionRow + TransactionLedgerTable) ← SPECCED
```

Phases 1–4 are prerequisites for Phase 5. Phase 5 → Phase 6 → Phase 7 (strict dependency chain).
Phases 3 and 4 can be developed in parallel; Phase 7 cannot be tested end-to-end until Phase 6 is deployed.

---

## Phase 1 — Schema Migration

**File to modify:** `prisma/schema.prisma`

Add one nullable field to `Transaction`:

```prisma
model Transaction {
  id              String                  @id @default(cuid())
  date            DateTime
  description     String
  amount          Decimal                 @db.Money
  type            TransactionTypeEnum
  category        String
  offsetCategory  String?                 // ← NEW: non-null only when category = 'Reimbursement'
  source          TransactionSourceEnum
  status          TransactionStatusEnum   @default(PENDING)
  confirmedAt     DateTime?
  bankAccount     BankAccount?            @relation(fields: [bankAccountId], references: [id])
  bankAccountId   String?
  user            User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String
  importSession   ImportSession?          @relation(fields: [importSessionId], references: [id])
  importSessionId String?
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}
```

**Run migration:**
```bash
pnpm prisma migrate dev --name add_transaction_offset_category
```

No seed changes needed. Existing rows have `offsetCategory = NULL`, which is the correct
value for all non-Reimbursement transactions.

### Test — Phase 1

```typescript
// vitest integration test
it('Transaction model accepts offsetCategory = null (existing rows unaffected)', async () => {
  const tx = await prisma.transaction.create({ data: { ...validDebitData } });
  expect(tx.offsetCategory).toBeNull();
});

it('Transaction model accepts offsetCategory string', async () => {
  const tx = await prisma.transaction.create({
    data: { ...validCreditData, category: 'Reimbursement', offsetCategory: 'Food & Dining' },
  });
  expect(tx.offsetCategory).toBe('Food & Dining');
});
```

---

## Phase 2 — Constants + Service Layer

### 2.1 Constants file

**File to create:** `src/server/services/transactions/constants.ts`

```typescript
export const REIMBURSEMENT_CATEGORY = 'Reimbursement' as const;

/**
 * CREDIT transaction categories that map to status = EXCLUDED at import time.
 * These transactions write no downstream record (no IncomeRecord, no MonthlyExpenseSummary).
 * Users can later promote a Reimbursement row by setting its offset category.
 */
export const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded', 'Reimbursement'] as const;
```

**File to modify:** `src/server/services/transactions/csv-confirm.service.ts`

Replace the inline constant (line 13) with an import:

```typescript
// BEFORE
const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded'];

// AFTER
import { EXCLUDED_CREDIT_LABELS } from './constants';
```

No other changes to `csv-confirm.service.ts`. The additional `'Reimbursement'` entry ensures
LLM-pre-labelled reimbursements land as `EXCLUDED` (same as Transfer), giving users a
consistent starting state.

---

### 2.2 New service functions

**File to modify:** `src/server/services/transactions/ledger.service.ts`

Add two new exported functions **after** the existing `updateIncomeRecordSource` function.
Both follow the identical CalendarYear → ExpenseLedger → ExpenseCategory lookup chain used
by `rerollupExpenseSummary`.

```typescript
import { REIMBURSEMENT_CATEGORY } from './constants';

/**
 * Decrements MonthlyExpenseSummary.amount for `offsetCategory` by `amount`.
 * Called when a CREDIT transaction is promoted to Reimbursement.
 * The summary amount can become negative (reimbursed more than spent in the month).
 */
export async function applyReimbursementOffset(params: {
  prismaClient: PrismaClient;
  userId: string;
  offsetCategory: string;  // name of the ExpenseCategory being reduced
  amount: Decimal;
  date: Date;
}): Promise<void> {
  const fiscalCalendar = await params.prismaClient.calendarYear.findFirst({
    where: { type: 'FISCAL' },
    select: { id: true },
  });
  if (!fiscalCalendar) return;

  const expenseLedger = await params.prismaClient.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: fiscalCalendar.id, userId: params.userId } },
    select: { id: true },
  });
  if (!expenseLedger) return;

  const month = params.date.getMonth() + 1;

  const category = await params.prismaClient.expenseCategory.findFirst({
    where: { name: params.offsetCategory, isActive: true },
    select: { id: true },
  });
  if (!category) return;  // unknown category — silent no-op; UI select prevents this

  await params.prismaClient.monthlyExpenseSummary.updateMany({
    where: { expenseLedgerId: expenseLedger.id, categoryId: category.id, month },
    data: { amount: { decrement: params.amount } },
  });
}

/**
 * Increments MonthlyExpenseSummary.amount for `offsetCategory` by `amount`.
 * Called when a Reimbursement CREDIT is demoted back to EXCLUDED (user removes Reimbursement).
 * Symmetric inverse of applyReimbursementOffset.
 */
export async function reverseReimbursementOffset(params: {
  prismaClient: PrismaClient;
  userId: string;
  offsetCategory: string;
  amount: Decimal;
  date: Date;
}): Promise<void> {
  const fiscalCalendar = await params.prismaClient.calendarYear.findFirst({
    where: { type: 'FISCAL' },
    select: { id: true },
  });
  if (!fiscalCalendar) return;

  const expenseLedger = await params.prismaClient.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: fiscalCalendar.id, userId: params.userId } },
    select: { id: true },
  });
  if (!expenseLedger) return;

  const month = params.date.getMonth() + 1;

  const category = await params.prismaClient.expenseCategory.findFirst({
    where: { name: params.offsetCategory, isActive: true },
    select: { id: true },
  });
  if (!category) return;

  const existing = await params.prismaClient.monthlyExpenseSummary.findFirst({
    where: { expenseLedgerId: expenseLedger.id, categoryId: category.id, month },
    select: { id: true },
  });

  if (existing) {
    await params.prismaClient.monthlyExpenseSummary.update({
      where: { id: existing.id },
      data: { amount: { increment: params.amount } },
    });
  } else {
    // Edge case: summary row was deleted externally; recreate with amount as baseline.
    await params.prismaClient.monthlyExpenseSummary.create({
      data: {
        month,
        amount: params.amount,
        categoryId: category.id,
        expenseLedgerId: expenseLedger.id,
      },
    });
  }
}
```

### Tests — Phase 2

```typescript
// vitest unit tests (mock prismaClient)

describe('applyReimbursementOffset', () => {
  it('decrements MonthlyExpenseSummary by amount when all records exist', async () => {
    // arrange: mock returns fiscal calendar, expense ledger, category, summary
    // assert: updateMany called with { decrement: amount }
  });

  it('is a no-op when no fiscal calendar exists', async () => {
    // arrange: calendarYear.findFirst returns null
    // assert: no further DB calls
  });

  it('is a no-op when expense ledger does not exist for user', async () => {
    // arrange: expenseLedger.findUnique returns null
    // assert: no updateMany call
  });

  it('is a no-op when offsetCategory is not a known active ExpenseCategory', async () => {
    // arrange: expenseCategory.findFirst returns null
    // assert: no updateMany call
  });
});

describe('reverseReimbursementOffset', () => {
  it('increments existing MonthlyExpenseSummary by amount', async () => {
    // assert: update called with { increment: amount }
  });

  it('creates a new MonthlyExpenseSummary row when none exists', async () => {
    // arrange: findFirst returns null
    // assert: create called with { amount: amount }
  });
});
```

---

## Phase 3 — tRPC Router Changes

**File to modify:** `src/server/trpc/router/transaction-ledger.ts`

### 3.1 New imports

```typescript
import { REIMBURSEMENT_CATEGORY } from '@/server/services/transactions/constants';
import {
  rerollupExpenseSummary,
  updateIncomeRecordSource,
  applyReimbursementOffset,    // ← new
  reverseReimbursementOffset,  // ← new
} from '@/server/services/transactions/ledger.service';
```

### 3.2 Extended `TransactionRow` interface

```typescript
export interface TransactionRow {
  id:              string;
  date:            string;
  description:     string;
  amount:          number;
  type:            TransactionTypeEnum;
  category:        string;
  source:          TransactionSourceEnum;
  status:          TransactionStatusEnum;
  confirmedAt:     string | null;
  bankAccountId:   string | null;
  bankAccountName: string | null;
  bankName:        string | null;
  offsetCategory:  string | null;  // ← new
}
```

### 3.3 Extended `PrismaTransaction` type

```typescript
type PrismaTransaction = {
  id:             string;
  date:           Date;
  description:    string;
  amount:         Decimal;
  type:           TransactionTypeEnum;
  category:       string;
  offsetCategory: string | null;  // ← new
  source:         TransactionSourceEnum;
  status:         TransactionStatusEnum;
  confirmedAt:    Date | null;
  bankAccountId:  string | null;
  bankAccount?:   { name: string; bank?: { name: string | null } | null } | null;
  userId:         string;
  importSessionId: string | null;
  createdAt:      Date;
  updatedAt:      Date;
};
```

### 3.4 `getAll` — add `offsetCategory` to the map

```typescript
// Inside the .map((tx) => ({ ... })) callback, add:
offsetCategory: tx.offsetCategory ?? null,
```

The `findMany` include needs no change — Prisma automatically returns all scalar fields.

### 3.5 Extended `updateCategorySchema`

Replace the current schema:

```typescript
// BEFORE
const updateCategorySchema = z.object({
  id:          z.string().min(1),
  newCategory: z.string().min(1),
});

// AFTER
const updateCategorySchema = z
  .object({
    id:             z.string().min(1),
    newCategory:    z.string().min(1),
    offsetCategory: z.string().optional(),  // required when newCategory === 'Reimbursement'
  })
  .refine(
    (data) =>
      data.newCategory !== REIMBURSEMENT_CATEGORY || (!!data.offsetCategory && data.offsetCategory.length > 0),
    {
      message: 'offsetCategory is required when category is Reimbursement',
      path: ['offsetCategory'],
    },
  );
```

### 3.6 Extended `updateCategory` mutation handler

Replace the entire mutation handler body with the following. Changes from the current
implementation are marked with `// ← CHANGED` or `// ← NEW`.

```typescript
updateCategory: protectedProcedure.input(updateCategorySchema).mutation(async ({ ctx, input }) => {
  const userId = ctx.session.user.id;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: input.id },
    select: {
      id:             true,
      userId:         true,
      type:           true,
      status:         true,
      category:       true,
      offsetCategory: true,  // ← NEW: fetch existing offsetCategory for reversal
      amount:         true,
      date:           true,
    },
  });

  if (!transaction || transaction.userId !== userId) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }

  // ← NEW: guard — only CREDIT transactions may be Reimbursement
  if (
    input.newCategory === REIMBURSEMENT_CATEGORY &&
    transaction.type !== TransactionTypeEnum.CREDIT
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Reimbursement category is only valid for CREDIT transactions',
    });
  }

  // ← NEW: determine status transition
  let newStatus: TransactionStatusEnum = transaction.status;
  let newConfirmedAt: Date | undefined;

  if (
    input.newCategory === REIMBURSEMENT_CATEGORY &&
    transaction.status === TransactionStatusEnum.EXCLUDED
  ) {
    // EXCLUDED → CONFIRMED: reimbursement is real money
    newStatus = TransactionStatusEnum.CONFIRMED;
    newConfirmedAt = new Date();
  } else if (
    transaction.category === REIMBURSEMENT_CATEGORY &&
    input.newCategory !== REIMBURSEMENT_CATEGORY &&
    transaction.status === TransactionStatusEnum.CONFIRMED
  ) {
    // CONFIRMED Reimbursement → demote back to EXCLUDED
    newStatus = TransactionStatusEnum.EXCLUDED;
  }

  // Write the updated Transaction row
  await ctx.prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      category:       input.newCategory,
      source:         TransactionSourceEnum.USER_OVERRIDE,
      status:         newStatus,                             // ← NEW
      ...(newConfirmedAt ? { confirmedAt: newConfirmedAt } : {}),  // ← NEW
      // ← NEW: persist offsetCategory or clear it
      offsetCategory:
        input.newCategory === REIMBURSEMENT_CATEGORY
          ? (input.offsetCategory ?? null)
          : null,
    },
  });

  // ─── Roll-up side-effects ───────────────────────────────────────────────

  const categoryChanged   = transaction.category !== input.newCategory;
  const offsetCatChanged  = transaction.offsetCategory !== (input.offsetCategory ?? null);

  // Case A — Category changed FROM non-Reimbursement TO Reimbursement  ← NEW
  if (transaction.category !== REIMBURSEMENT_CATEGORY && input.newCategory === REIMBURSEMENT_CATEGORY) {
    if (input.offsetCategory) {
      await applyReimbursementOffset({
        prismaClient:   ctx.prisma,
        userId,
        offsetCategory: input.offsetCategory,
        amount:         transaction.amount as Decimal,
        date:           transaction.date,
      });
    }
  }

  // Case B — Category changed FROM Reimbursement TO non-Reimbursement    ← NEW
  else if (transaction.category === REIMBURSEMENT_CATEGORY && input.newCategory !== REIMBURSEMENT_CATEGORY) {
    if (transaction.offsetCategory) {
      await reverseReimbursementOffset({
        prismaClient:   ctx.prisma,
        userId,
        offsetCategory: transaction.offsetCategory,
        amount:         transaction.amount as Decimal,
        date:           transaction.date,
      });
    }
  }

  // Case C — Stays Reimbursement but offsetCategory changed              ← NEW
  else if (
    transaction.category === REIMBURSEMENT_CATEGORY &&
    input.newCategory === REIMBURSEMENT_CATEGORY &&
    offsetCatChanged
  ) {
    if (transaction.offsetCategory) {
      await reverseReimbursementOffset({
        prismaClient:   ctx.prisma,
        userId,
        offsetCategory: transaction.offsetCategory,
        amount:         transaction.amount as Decimal,
        date:           transaction.date,
      });
    }
    if (input.offsetCategory) {
      await applyReimbursementOffset({
        prismaClient:   ctx.prisma,
        userId,
        offsetCategory: input.offsetCategory,
        amount:         transaction.amount as Decimal,
        date:           transaction.date,
      });
    }
  }

  // Case D — DEBIT + CONFIRMED: standard expense re-rollup (unchanged)
  else if (
    transaction.type === TransactionTypeEnum.DEBIT &&
    transaction.status === TransactionStatusEnum.CONFIRMED &&
    categoryChanged
  ) {
    await rerollupExpenseSummary({
      prismaClient: ctx.prisma,
      userId,
      oldCategory:  transaction.category,
      newCategory:  input.newCategory,
      amount:       transaction.amount as Decimal,
      date:         transaction.date,
    });
  }

  // Case E — CREDIT + CONFIRMED + neither old nor new is Reimbursement: income source update (unchanged)
  else if (
    transaction.type === TransactionTypeEnum.CREDIT &&
    transaction.status === TransactionStatusEnum.CONFIRMED &&
    transaction.category !== REIMBURSEMENT_CATEGORY &&
    input.newCategory !== REIMBURSEMENT_CATEGORY &&
    categoryChanged
  ) {
    await updateIncomeRecordSource({
      prismaClient:    ctx.prisma,
      userId,
      newSource:       input.newCategory as IncomeSourceEnumType,
      amount:          transaction.amount as Decimal,
      transactionDate: transaction.date,
    });
  }

  return { success: true };
}),
```

### Tests — Phase 3

```typescript
describe('transactionLedger.updateCategory — Reimbursement logic', () => {

  it('promotes EXCLUDED CREDIT to CONFIRMED when newCategory = Reimbursement', async () => {
    // arrange: CREDIT, EXCLUDED, category='Transfer'
    // act: updateCategory({ id, newCategory: 'Reimbursement', offsetCategory: 'Food & Dining' })
    // assert: transaction.status === CONFIRMED
    // assert: transaction.offsetCategory === 'Food & Dining'
    // assert: transaction.confirmedAt is a Date
    // assert: applyReimbursementOffset called once
  });

  it('demotes CONFIRMED Reimbursement to EXCLUDED when newCategory ≠ Reimbursement', async () => {
    // arrange: CREDIT, CONFIRMED, category='Reimbursement', offsetCategory='Food & Dining'
    // act: updateCategory({ id, newCategory: 'Transfer' })
    // assert: transaction.status === EXCLUDED
    // assert: transaction.offsetCategory === null
    // assert: reverseReimbursementOffset called with 'Food & Dining'
  });

  it('swaps offset roll-up when offsetCategory changes (stays Reimbursement)', async () => {
    // arrange: CREDIT, CONFIRMED, category='Reimbursement', offsetCategory='Food & Dining'
    // act: updateCategory({ id, newCategory: 'Reimbursement', offsetCategory: 'Travel' })
    // assert: reverseReimbursementOffset('Food & Dining') called
    // assert: applyReimbursementOffset('Travel') called
    // assert: transaction.offsetCategory === 'Travel'
  });

  it('throws BAD_REQUEST when setting Reimbursement on a DEBIT transaction', async () => {
    // arrange: DEBIT, CONFIRMED
    // act + assert: TRPCError { code: 'BAD_REQUEST' }
  });

  it('throws BAD_REQUEST (Zod) when newCategory=Reimbursement but offsetCategory is absent', async () => {
    // Zod refine should reject at input validation level
  });

  it('does not call applyReimbursementOffset or reverseReimbursementOffset for DEBIT re-rollup', async () => {
    // arrange: DEBIT, CONFIRMED, category='Food & Dining'
    // act: updateCategory({ id, newCategory: 'Travel' })
    // assert: rerollupExpenseSummary called; apply/reverse NOT called
  });

  it('does not affect CONFIRMED CREDIT income rows (Case E unchanged)', async () => {
    // arrange: CREDIT, CONFIRMED, category='EMPLOYMENT'
    // act: updateCategory({ id, newCategory: 'DIVIDEND' })
    // assert: updateIncomeRecordSource called; apply/reverse NOT called
  });
});
```

---

## Phase 4 — UI Changes

### 4.1 `TransactionRow` — extended props and local state

**File to modify:** `src/components/transactions/TransactionRow.tsx`

#### Updated imports

```typescript
import { REIMBURSEMENT_CATEGORY } from '@/server/services/transactions/constants';
```

#### Updated `TransactionRowProps`

```typescript
interface TransactionRowProps {
  transaction:        LedgerTransactionRow;   // already includes offsetCategory: string | null
  expenseCategories:  Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  onCategoryChange:   (id: string, newCategory: string, offsetCategory?: string) => void;  // ← extended
  isSaving?:          boolean;
}
```

> **Note:** `LedgerTransactionRow` (= `TransactionRow` from the router) now includes
> `offsetCategory: string | null` after Phase 3. The import alias is unchanged.

#### New local state

```typescript
const [localOffsetCategory, setLocalOffsetCategory] = useState(transaction.offsetCategory ?? '');

// Sync on server refetch
useEffect(() => {
  setLocalOffsetCategory(transaction.offsetCategory ?? '');
}, [transaction.offsetCategory]);
```

#### Updated `handleChange`

```typescript
function handleChange(newCategory: string) {
  setLocalCategory(newCategory);
  if (newCategory !== REIMBURSEMENT_CATEGORY) {
    setLocalOffsetCategory('');
    onCategoryChange(transaction.id, newCategory);
  }
  // If switching to Reimbursement, wait for offset selection before firing
}

function handleOffsetChange(newOffsetCategory: string) {
  setLocalOffsetCategory(newOffsetCategory);
  onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, newOffsetCategory);
}
```

#### Updated category options logic

```typescript
// Show "Reimbursement" option for CREDIT rows that are EXCLUDED or currently Reimbursement
const showReimbursementOption =
  transaction.type === 'CREDIT' &&
  (transaction.status === 'EXCLUDED' || transaction.category === REIMBURSEMENT_CATEGORY);

const options =
  transaction.type === 'DEBIT'
    ? expenseCategories
    : incomeSourceLabels;  // Reimbursement appended below conditionally
```

#### Updated JSX — category cell

```tsx
<td className="px-4 py-3">
  <div className="flex flex-col gap-1">
    <select
      aria-label={`Category for ${transaction.description}`}
      value={localCategory}
      disabled={isSaving}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full min-w-[140px] rounded border border-gray-300 bg-transparent px-2 py-1
                 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500
                 disabled:cursor-wait disabled:opacity-60
                 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
    >
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.name;
        const key   = typeof option === 'string' ? option : option.id;
        return <option key={key} value={value}>{value}</option>;
      })}
      {showReimbursementOption && (
        <option value={REIMBURSEMENT_CATEGORY}>{REIMBURSEMENT_CATEGORY}</option>
      )}
    </select>

    {/* Offset category selector — only when Reimbursement is active */}
    {localCategory === REIMBURSEMENT_CATEGORY && (
      <select
        aria-label={`Offsets expense category for ${transaction.description}`}
        value={localOffsetCategory}
        disabled={isSaving}
        onChange={(e) => handleOffsetChange(e.target.value)}
        className="w-full min-w-[140px] rounded border border-teal-400 bg-transparent px-2 py-1
                   text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500
                   disabled:cursor-wait disabled:opacity-60
                   dark:border-teal-600 dark:bg-gray-800 dark:text-white"
      >
        <option value="" disabled>Offsets category…</option>
        {expenseCategories.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
    )}
  </div>
</td>
```

The teal border on the offset select provides a visual cue that it is a secondary,
context-dependent control.

---

### 4.2 `TransactionLedgerTable` — forward offsetCategory

**File to modify:** `src/components/transactions/TransactionLedgerTable.tsx`

#### Updated `handleCategoryChange`

```typescript
// BEFORE
const handleCategoryChange = useCallback((id: string, newCategory: string) => {
  setSavingId(id);
  updateCategoryMutation.mutate({ id, newCategory });
}, [updateCategoryMutation]);

// AFTER
const handleCategoryChange = useCallback(
  (id: string, newCategory: string, offsetCategory?: string) => {
    setSavingId(id);
    updateCategoryMutation.mutate({ id, newCategory, ...(offsetCategory ? { offsetCategory } : {}) });
  },
  [updateCategoryMutation],
);
```

#### Updated `TransactionRow` usage

```tsx
<TransactionRow
  key={transaction.id}
  transaction={transaction}
  expenseCategories={expenseCategories}
  incomeSourceLabels={incomeSourceLabels}
  onCategoryChange={handleCategoryChange}  // signature already matches
  isSaving={savingId === transaction.id}
/>
```

No other changes to `TransactionLedgerTable`.

---

### Tests — Phase 4

```typescript
// vitest + React Testing Library

describe('TransactionRow — Reimbursement UI', () => {

  it('renders "Reimbursement" option in dropdown for CREDIT+EXCLUDED row', () => {
    render(<TransactionRow transaction={creditExcludedRow} ... />);
    const select = screen.getByRole('combobox', { name: /category/i });
    expect(within(select).getByText('Reimbursement')).toBeInTheDocument();
  });

  it('does NOT render "Reimbursement" option for DEBIT row', () => {
    render(<TransactionRow transaction={debitConfirmedRow} ... />);
    const select = screen.getByRole('combobox', { name: /category/i });
    expect(within(select).queryByText('Reimbursement')).not.toBeInTheDocument();
  });

  it('does NOT render "Reimbursement" option for CREDIT+CONFIRMED (income) row', () => {
    render(<TransactionRow transaction={creditConfirmedIncomeRow} ... />);
    const select = screen.getByRole('combobox', { name: /category/i });
    expect(within(select).queryByText('Reimbursement')).not.toBeInTheDocument();
  });

  it('shows offset category select after choosing Reimbursement', async () => {
    render(<TransactionRow transaction={creditExcludedRow} ... />);
    const select = screen.getByRole('combobox', { name: /category/i });
    await userEvent.selectOptions(select, 'Reimbursement');
    expect(screen.getByRole('combobox', { name: /offsets expense category/i })).toBeInTheDocument();
  });

  it('hides offset category select when category changed back from Reimbursement', async () => {
    render(<TransactionRow transaction={creditReimbursementRow} ... />);
    // creditReimbursementRow has category='Reimbursement', offsetCategory='Food & Dining'
    const mainSelect = screen.getByRole('combobox', { name: /category/i });
    await userEvent.selectOptions(mainSelect, 'Transfer');
    expect(screen.queryByRole('combobox', { name: /offsets expense category/i })).not.toBeInTheDocument();
  });

  it('calls onCategoryChange with offsetCategory when offset is selected', async () => {
    const onCategoryChange = vi.fn();
    render(<TransactionRow transaction={creditExcludedRow} onCategoryChange={onCategoryChange} ... />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Reimbursement');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /offsets expense category/i }),
      'Food & Dining',
    );
    expect(onCategoryChange).toHaveBeenCalledWith(
      creditExcludedRow.id,
      'Reimbursement',
      'Food & Dining',
    );
  });

  it('pre-selects existing offsetCategory for an already-Reimbursement row', () => {
    render(<TransactionRow transaction={creditReimbursementRow} ... />);
    const offsetSelect = screen.getByRole('combobox', { name: /offsets expense category/i });
    expect((offsetSelect as HTMLSelectElement).value).toBe('Food & Dining');
  });
});
```

---

## Implementation Order

| Step | Task | Phase | Depends on |
|---|---|---|---|
| 1 | Prisma migration (`offsetCategory`) | 1 | — |
| 2 | `constants.ts` + update `csv-confirm.service.ts` import | 2 | 1 |
| 3 | `applyReimbursementOffset` + `reverseReimbursementOffset` | 2 | 1 |
| 4 | Extend `TransactionRow` interface + `PrismaTransaction` type | 3 | 1 |
| 5 | Extend `updateCategorySchema` + Zod refine | 3 | 2, 3 |
| 6 | Rewrite mutation handler (Cases A–E) | 3 | 4, 5 |
| 7 | `getAll` map — add `offsetCategory` | 3 | 4 |
| 8 | `TransactionRow` UI changes | 4 | 4 |
| 9 | `TransactionLedgerTable` `handleCategoryChange` update | 4 | 8 |
| 10 | Prisma migration (`offsetTransactionId` self-FK) | 5 | 1–9 |
| 11 | Extend `updateCategorySchema` with `offsetTransactionId` | 6 | 10 |
| 12 | Add `offsetTransactionId` validation + write to mutation | 6 | 11 |
| 13 | Extend `TransactionRow` interface + `PrismaTransaction` with `reimbursements[]` | 6 | 10 |
| 14 | Extend `getAll` findMany include + map | 6 | 13 |
| 15 | Add `searchDebitTransactions` query | 6 | 10 |
| 16 | `ReimbursementSubRow` component | 7 | 13 |
| 17 | `TransactionRow` accordion (DEBIT rows) + net amount label | 7 | 13, 16 |
| 18 | `TransactionRow` "Link to expense" picker (CREDIT Reimbursement rows) | 7 | 15, 17 |
| 19 | `TransactionLedgerTable` extend `handleCategoryChange` for `offsetTransactionId` | 7 | 18 |

Steps 1–9 are complete. Steps 10–19 are the Phase 2 implementation.

---

## Phase 5 — Schema: offsetTransactionId FK

**File to modify:** `prisma/schema.prisma`

Add a self-referential nullable FK to `Transaction`:

```prisma
model Transaction {
  id              String                  @id @default(cuid())
  date            DateTime
  description     String
  amount          Decimal                 @db.Money
  type            TransactionTypeEnum
  category        String
  offsetCategory  String?                 // non-null only when category = 'Reimbursement'
  offsetTransactionId String?             // ← NEW: optional FK to the DEBIT being reimbursed
  source          TransactionSourceEnum
  status          TransactionStatusEnum   @default(PENDING)
  confirmedAt     DateTime?
  bankAccount     BankAccount?            @relation(fields: [bankAccountId], references: [id])
  bankAccountId   String?
  user            User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String
  importSession   ImportSession?          @relation(fields: [importSessionId], references: [id])
  importSessionId String?
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  // ← NEW: self-referential relations
  offsetTransaction  Transaction?   @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements     Transaction[]  @relation("ReimbursementLink")

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}
```

**Run migration (stop dev server first on Windows):**
```bash
pnpm prisma migrate dev --name add_transaction_offset_transaction_id
```

Existing rows have `offsetTransactionId = NULL`, which is correct. No backfill needed.

### Tests — Phase 5

```typescript
// vitest integration tests
it('Transaction model accepts offsetTransactionId = null (existing rows unaffected)', async () => {
  const tx = await prisma.transaction.create({ data: { ...validCreditReimbursementData } });
  expect(tx.offsetTransactionId).toBeNull();
});

it('Transaction model accepts valid offsetTransactionId FK', async () => {
  const debit = await prisma.transaction.create({ data: { ...validDebitData } });
  const credit = await prisma.transaction.create({
    data: { ...validCreditReimbursementData, offsetTransactionId: debit.id },
  });
  expect(credit.offsetTransactionId).toBe(debit.id);
});

it('Transaction.reimbursements back-relation returns linked CREDIT rows', async () => {
  const debit = await prisma.transaction.create({ data: { ...validDebitData } });
  await prisma.transaction.create({
    data: { ...validCreditReimbursementData, offsetTransactionId: debit.id },
  });
  const withReimbursements = await prisma.transaction.findUnique({
    where: { id: debit.id },
    include: { reimbursements: true },
  });
  expect(withReimbursements?.reimbursements).toHaveLength(1);
});
```

---

## Phase 6 — Router: Link Support

**File to modify:** `src/server/trpc/router/transaction-ledger.ts`

### 6.1 Extended `updateCategorySchema`

```typescript
const updateCategorySchema = z
  .object({
    id:                  z.string().min(1),
    newCategory:         z.string().min(1),
    offsetCategory:      z.string().optional(),
    offsetTransactionId: z.string().optional(),  // ← NEW
  })
  .refine(
    (data) =>
      data.newCategory !== REIMBURSEMENT_CATEGORY ||
      (!!data.offsetCategory && data.offsetCategory.length > 0),
    {
      message: 'offsetCategory is required when category is Reimbursement',
      path: ['offsetCategory'],
    },
  );
```

### 6.2 Extended `PrismaTransaction` type

```typescript
type PrismaReimbursement = {
  id:             string;
  date:           Date;
  description:    string;
  amount:         Decimal;
  type:           TransactionTypeEnum;
  category:       string;
  offsetCategory: string | null;
  source:         TransactionSourceEnum;
  status:         TransactionStatusEnum;
  confirmedAt:    Date | null;
  bankAccountId:  string | null;
  bankAccount?:   { name: string; bank?: { name: string | null } | null } | null;
};

type PrismaTransaction = {
  // ... all existing fields ...
  offsetTransactionId: string | null;  // ← NEW
  reimbursements:      PrismaReimbursement[];  // ← NEW: populated by include
};
```

### 6.3 Extended `TransactionRow` interface

```typescript
export interface TransactionRow {
  // ... all existing fields ...
  offsetTransactionId: string | null;   // ← NEW
  reimbursements:      TransactionRow[]; // ← NEW: [] for CREDIT rows or unlinked DEBIT rows
}
```

### 6.4 Extended `getAll` — findMany include

```typescript
ctx.prisma.transaction.findMany({
  where,
  orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  skip: (input.page - 1) * input.limit,
  take: input.limit,
  include: {
    bankAccount: { select: { name: true, bank: { select: { name: true } } } },
    reimbursements: {                                  // ← NEW
      where: { category: REIMBURSEMENT_CATEGORY },
      select: {
        id: true, date: true, description: true, amount: true, type: true,
        category: true, offsetCategory: true, source: true, status: true,
        confirmedAt: true, bankAccountId: true,
        bankAccount: { select: { name: true, bank: { select: { name: true } } } },
      },
    },
  },
})
```

### 6.5 Extended `getAll` map

```typescript
// Inside the .map((tx) => ({ ... })) callback, add:
offsetTransactionId: tx.offsetTransactionId ?? null,
reimbursements: (tx.reimbursements ?? []).map((r) => ({
  id:                  r.id,
  date:                r.date.toISOString(),
  description:         r.description,
  amount:              Number(r.amount),
  type:                r.type,
  category:            r.category,
  offsetCategory:      r.offsetCategory ?? null,
  source:              r.source,
  status:              r.status,
  confirmedAt:         r.confirmedAt ? r.confirmedAt.toISOString() : null,
  bankAccountId:       r.bankAccountId,
  bankAccountName:     r.bankAccount?.name ?? null,
  bankName:            r.bankAccount?.bank?.name ?? null,
  offsetTransactionId: null,   // leaf node — reimbursements are never DEBIT rows
  reimbursements:      [],
})),
```

### 6.6 Extended `updateCategory` mutation handler

Add after the existing `transaction.findUnique` select (add `offsetTransactionId: true` to the select):

```typescript
select: {
  id:                  true,
  userId:              true,
  type:                true,
  status:              true,
  category:            true,
  offsetCategory:      true,
  offsetTransactionId: true,   // ← NEW
  amount:              true,
  date:                true,
},
```

Add the validation block **after** the existing DEBIT guard and **before** the status-transition block:

```typescript
// Guard — validate offsetTransactionId if provided
if (input.offsetTransactionId) {
  const linked = await ctx.prisma.transaction.findUnique({
    where: { id: input.offsetTransactionId },
    select: { userId: true, type: true, status: true },
  });
  if (!linked || linked.userId !== userId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Linked transaction not found' });
  }
  if (
    linked.type !== TransactionTypeEnum.DEBIT ||
    linked.status !== TransactionStatusEnum.CONFIRMED
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Linked transaction must be a confirmed expense (DEBIT)',
    });
  }
}
```

In the `transaction.update` data block, add:

```typescript
data: {
  category:            input.newCategory,
  source:              TransactionSourceEnum.USER_OVERRIDE,
  status:              newStatus,
  ...(newConfirmedAt ? { confirmedAt: newConfirmedAt } : {}),
  offsetCategory:
    input.newCategory === REIMBURSEMENT_CATEGORY
      ? (input.offsetCategory ?? null)
      : null,
  offsetTransactionId:                               // ← NEW
    input.newCategory === REIMBURSEMENT_CATEGORY
      ? (input.offsetTransactionId ?? null)
      : null,
},
```

Case B (demotion from Reimbursement) already clears `offsetTransactionId` via the `null` path
above — no additional logic required.

### 6.7 New `searchDebitTransactions` query

Add inside `transactionLedgerRouter`:

```typescript
searchDebitTransactions: protectedProcedure
  .input(
    z.object({
      search: z.string().optional(),
      limit:  z.number().int().min(1).max(20).default(10),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const transactions = await ctx.prisma.transaction.findMany({
      where: {
        userId,
        type:   TransactionTypeEnum.DEBIT,
        status: TransactionStatusEnum.CONFIRMED,
        ...(input.search?.trim()
          ? {
              OR: [
                { description: { contains: input.search.trim(), mode: 'insensitive' } },
                { category:    { contains: input.search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }],
      take:    input.limit,
      select:  { id: true, date: true, description: true, amount: true, category: true },
    });
    return transactions.map((tx) => ({
      id:          tx.id,
      date:        tx.date.toISOString().slice(0, 10),
      description: tx.description,
      amount:      Number(tx.amount),
      category:    tx.category,
    }));
  }),
```

### Tests — Phase 6

```typescript
describe('transactionLedger.updateCategory — offsetTransactionId', () => {

  it('accepts and persists offsetTransactionId when linking to a DEBIT+CONFIRMED transaction', async () => {
    // arrange: existing CREDIT EXCLUDED + a DEBIT CONFIRMED to link to
    // act: updateCategory({ id, newCategory: 'Reimbursement', offsetCategory: 'Food & Dining', offsetTransactionId: debitId })
    // assert: transaction.offsetTransactionId === debitId
  });

  it('rejects offsetTransactionId that points to a CREDIT transaction', async () => {
    // assert: TRPCError { code: 'BAD_REQUEST' }
  });

  it('rejects offsetTransactionId that belongs to a different user', async () => {
    // assert: TRPCError { code: 'NOT_FOUND' }
  });

  it('clears offsetTransactionId when demoting from Reimbursement (Case B)', async () => {
    // arrange: CREDIT CONFIRMED Reimbursement with offsetTransactionId set
    // act: updateCategory({ id, newCategory: 'Transfer' })
    // assert: transaction.offsetTransactionId === null
  });

  it('updates offsetTransactionId when linking to a different DEBIT (Case C)', async () => {
    // arrange: CREDIT CONFIRMED Reimbursement linked to debitA
    // act: updateCategory({ id, newCategory: 'Reimbursement', offsetCategory: 'Food & Dining', offsetTransactionId: debitB })
    // assert: transaction.offsetTransactionId === debitB.id
  });
});

describe('transactionLedger.searchDebitTransactions', () => {

  it('returns only DEBIT+CONFIRMED transactions for the authenticated user', async () => {
    // assert: no CREDIT or EXCLUDED rows in result
  });

  it('filters by description when search is provided', async () => {
    // assert: results contain search term in description
  });

  it('returns at most `limit` results', async () => {
    // assert: result.length <= input.limit
  });

  it('returns empty array when no matching DEBIT transactions exist', async () => {
    // assert: result === []
  });
});

describe('transactionLedger.getAll — reimbursements sub-list', () => {

  it('embeds linked reimbursements on the parent DEBIT row', async () => {
    // arrange: DEBIT + linked CREDIT Reimbursement (offsetTransactionId set)
    // assert: debitRow.reimbursements has length 1 with correct id
  });

  it('returns empty reimbursements array for DEBIT rows with no linked reimbursements', async () => {
    // assert: debitRow.reimbursements === []
  });

  it('returns empty reimbursements array for all CREDIT rows', async () => {
    // assert: creditRow.reimbursements === []
  });
});
```

---

## Phase 7 — UI: Accordion + Transaction Picker

### 7.1 New component: `ReimbursementSubRow`

**File to create:** `src/components/transactions/ReimbursementSubRow.tsx`

```tsx
'use client';

import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';

interface ReimbursementSubRowProps {
  reimbursement: LedgerTransactionRow;
  colCount: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

export default function ReimbursementSubRow({ reimbursement, colCount }: ReimbursementSubRowProps) {
  return (
    <tr className="border-b border-teal-100 bg-teal-50/50 dark:border-teal-900/30 dark:bg-teal-950/20">
      <td className="w-8" /> {/* indent spacer — aligns with parent chevron cell */}
      <td className="py-2 pl-6 text-sm text-gray-500 dark:text-gray-400">
        {reimbursement.date.slice(0, 10)}
      </td>
      <td className="max-w-[220px] px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-1">
          <span className="text-teal-500 shrink-0">↩</span>
          <span className="truncate" title={reimbursement.description}>
            {reimbursement.description}
          </span>
        </div>
      </td>
      <td className="px-4 py-2 text-sm font-medium tabular-nums text-teal-600 dark:text-teal-400">
        {formatCurrency(reimbursement.amount)}
      </td>
      <td colSpan={colCount - 4} className="px-4 py-2 text-xs text-teal-600 dark:text-teal-400">
        offsets {reimbursement.offsetCategory ?? '—'}
      </td>
    </tr>
  );
}
```

The `colCount` prop should equal the total number of columns in the parent table (currently 8).
Pass it from `TransactionLedgerTable` as a constant so the sub-row spans correctly.

---

### 7.2 `TransactionRow` — accordion + picker

**File to modify:** `src/components/transactions/TransactionRow.tsx`

#### New imports

```typescript
import { useState, useEffect, useRef } from 'react';  // add useRef
import { trpc } from '@/server/trpc/client';
import ReimbursementSubRow from './ReimbursementSubRow';
```

#### Updated `TransactionRowProps`

```typescript
interface TransactionRowProps {
  transaction:        LedgerTransactionRow;
  expenseCategories:  Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  onCategoryChange:   (
    id: string,
    newCategory: string,
    offsetCategory?: string,
    offsetTransactionId?: string | null,  // ← NEW
  ) => void;
  isSaving?:   boolean;
  colCount?:   number;  // ← NEW: total column count for sub-row colSpan (default 8)
}
```

#### New local state

```typescript
const [isExpanded, setIsExpanded]       = useState(false);
const [pickerOpen, setPickerOpen]       = useState(false);
const [pickerSearch, setPickerSearch]   = useState('');
const [localOffsetTxId, setLocalOffsetTxId] = useState(transaction.offsetTransactionId ?? null);

// Sync on server refetch
useEffect(() => {
  setLocalOffsetTxId(transaction.offsetTransactionId ?? null);
}, [transaction.offsetTransactionId]);
```

#### Lazy `searchDebitTransactions` query

```typescript
const searchQuery = trpc.transactionLedger.searchDebitTransactions.useQuery(
  { search: pickerSearch, limit: 10 },
  { enabled: pickerOpen },
);
```

#### Net amount computation

```typescript
const totalReimbursed = transaction.reimbursements.reduce((sum, r) => sum + r.amount, 0);
const netAmount       = transaction.amount - totalReimbursed;
const hasReimbursements = transaction.reimbursements.length > 0;
```

#### `handleOffsetChange` (extended to pass offsetTransactionId)

```typescript
function handleOffsetChange(newOffsetCategory: string) {
  setLocalOffsetCategory(newOffsetCategory);
  onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, newOffsetCategory, localOffsetTxId);
}

function handleLinkTransaction(linkedId: string | null) {
  setLocalOffsetTxId(linkedId);
  setPickerOpen(false);
  setPickerSearch('');
  onCategoryChange(transaction.id, REIMBURSEMENT_CATEGORY, localOffsetCategory || undefined, linkedId);
}
```

#### Updated JSX — main `<tr>` (DEBIT rows with reimbursements)

Replace the `<tr>` opening tag with a fragment and add the expand chevron:

```tsx
return (
  <>
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {/* Chevron cell — only for DEBIT rows with reimbursements */}
      <td className="w-8 px-1 py-3 text-center">
        {hasReimbursements && (
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse reimbursements' : 'Expand reimbursements'}
            onClick={() => setIsExpanded((v) => !v)}
            className="text-gray-400 hover:text-teal-500 transition-colors"
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        )}
      </td>
      {/* Date */}
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {transaction.date.slice(0, 10)}
      </td>
      {/* Description */}
      <td className="max-w-[240px] px-4 py-3 text-sm text-gray-900 dark:text-white">
        <span className="block truncate" title={transaction.description}>
          {transaction.description}
        </span>
      </td>
      {/* Amount — with net label when reimbursements exist */}
      <td className={`px-4 py-3 text-sm font-medium tabular-nums ${amountClass}`}>
        <div className="flex flex-col">
          <span>{formatCurrency(transaction.amount)}</span>
          {hasReimbursements && (
            <span className="text-xs text-teal-600 dark:text-teal-400">
              net {formatCurrency(netAmount)}
            </span>
          )}
        </div>
      </td>
      {/* ... rest of existing cells unchanged ... */}
    </tr>

    {/* Accordion sub-rows */}
    {isExpanded &&
      transaction.reimbursements.map((r) => (
        <ReimbursementSubRow key={r.id} reimbursement={r} colCount={colCount ?? 9} />
      ))}
  </>
);
```

> **Important:** Adding the chevron cell increases the column count from 8 to 9.
> Update `TransactionLedgerTable`'s header row to include an empty `<th>` as the first column.

#### "Link to expense" picker — JSX (CREDIT Reimbursement rows)

Add below the offset-category `<select>` inside `{localCategory === REIMBURSEMENT_CATEGORY && (...)}`:

```tsx
{/* Link to expense — optional */}
<div className="mt-1">
  {localOffsetTxId ? (
    // Linked state — show linked transaction + unlink button
    <div className="flex items-center gap-1 rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs dark:border-teal-700 dark:bg-teal-950/30">
      <span className="text-teal-500">🔗</span>
      <span className="truncate text-teal-700 dark:text-teal-300">
        {searchQuery.data?.find((t) => t.id === localOffsetTxId)?.description ?? 'Linked expense'}
      </span>
      <button
        type="button"
        aria-label="Unlink expense"
        onClick={() => handleLinkTransaction(null)}
        className="ml-auto text-gray-400 hover:text-red-500"
      >
        ✕
      </button>
    </div>
  ) : (
    // Unlinked state — toggle picker open
    !pickerOpen ? (
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="text-xs text-teal-600 hover:underline dark:text-teal-400"
      >
        ＋ Link to original expense
      </button>
    ) : (
      // Picker open — search input + results
      <div className="relative">
        <input
          autoFocus
          type="text"
          placeholder="Search expenses…"
          value={pickerSearch}
          onChange={(e) => setPickerSearch(e.target.value)}
          className="w-full rounded border border-teal-400 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-gray-800 dark:text-white"
        />
        {searchQuery.data && searchQuery.data.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-md dark:border-gray-600 dark:bg-gray-800">
            {searchQuery.data.map((tx) => (
              <li key={tx.id}>
                <button
                  type="button"
                  onClick={() => handleLinkTransaction(tx.id)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-teal-50 dark:hover:bg-teal-900/20"
                >
                  <span className="truncate">{tx.description}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-gray-500">
                    {tx.date} · {formatCurrency(tx.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => { setPickerOpen(false); setPickerSearch(''); }}
          className="mt-1 text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    )
  )}
</div>
```

---

### 7.3 `TransactionLedgerTable` — table header + handleCategoryChange

**File to modify:** `src/components/transactions/TransactionLedgerTable.tsx`

#### Add empty header column for the chevron cell

```tsx
{/* BEFORE */}
{['Date', 'Description', 'Amount', 'Type', 'Category', 'Source', 'Status', 'Bank Account'].map((h) => (
  <th key={h} ...>{h}</th>
))}

{/* AFTER */}
<th className="w-8 px-1 py-3" /> {/* chevron column */}
{['Date', 'Description', 'Amount', 'Type', 'Category', 'Source', 'Status', 'Bank Account'].map((h) => (
  <th key={h} ...>{h}</th>
))}
```

#### Updated `handleCategoryChange`

```typescript
// BEFORE
const handleCategoryChange = useCallback(
  (id: string, newCategory: string, offsetCategory?: string) => {
    setSavingId(id);
    updateCategoryMutation.mutate({ id, newCategory, ...(offsetCategory ? { offsetCategory } : {}) });
  },
  [updateCategoryMutation],
);

// AFTER
const handleCategoryChange = useCallback(
  (id: string, newCategory: string, offsetCategory?: string, offsetTransactionId?: string | null) => {
    setSavingId(id);
    updateCategoryMutation.mutate({
      id,
      newCategory,
      ...(offsetCategory ? { offsetCategory } : {}),
      ...(offsetTransactionId !== undefined
        ? { offsetTransactionId: offsetTransactionId ?? undefined }
        : {}),
    });
  },
  [updateCategoryMutation],
);
```

#### Pass `colCount` to `TransactionRow`

```tsx
<TransactionRow
  key={transaction.id}
  transaction={transaction}
  expenseCategories={expenseCategories}
  incomeSourceLabels={incomeSourceLabels}
  onCategoryChange={handleCategoryChange}
  isSaving={savingId === transaction.id}
  colCount={9}   // ← NEW: total column count including chevron
/>
```

---

### Tests — Phase 7

```typescript
// vitest + React Testing Library
const COL_COUNT = 9;

describe('TransactionRow — accordion (DEBIT with reimbursements)', () => {

  it('renders a chevron expand button for DEBIT rows with linked reimbursements', () => {
    render(<TransactionRow transaction={debitWithReimbursements} colCount={COL_COUNT} ... />);
    expect(screen.getByRole('button', { name: /expand reimbursements/i })).toBeInTheDocument();
  });

  it('does NOT render a chevron for DEBIT rows with no reimbursements', () => {
    render(<TransactionRow transaction={debitNoReimbursements} colCount={COL_COUNT} ... />);
    expect(screen.queryByRole('button', { name: /expand reimbursements/i })).not.toBeInTheDocument();
  });

  it('shows ReimbursementSubRow after expanding', async () => {
    render(<TransactionRow transaction={debitWithReimbursements} colCount={COL_COUNT} ... />);
    await userEvent.click(screen.getByRole('button', { name: /expand reimbursements/i }));
    expect(screen.getByText(debitWithReimbursements.reimbursements[0]!.description)).toBeInTheDocument();
  });

  it('hides ReimbursementSubRow after collapsing', async () => {
    render(<TransactionRow transaction={debitWithReimbursements} colCount={COL_COUNT} ... />);
    const chevron = screen.getByRole('button', { name: /expand reimbursements/i });
    await userEvent.click(chevron); // expand
    await userEvent.click(chevron); // collapse
    expect(screen.queryByText(debitWithReimbursements.reimbursements[0]!.description)).not.toBeInTheDocument();
  });

  it('shows net amount label when reimbursements exist', () => {
    render(<TransactionRow transaction={debitWithReimbursements} colCount={COL_COUNT} ... />);
    expect(screen.getByText(/net/i)).toBeInTheDocument();
  });
});

describe('TransactionRow — link to expense picker (CREDIT Reimbursement)', () => {

  it('shows "Link to original expense" toggle when category is Reimbursement and no link exists', async () => {
    render(<TransactionRow transaction={creditReimbursementNoLink} colCount={COL_COUNT} ... />);
    expect(screen.getByRole('button', { name: /link to original expense/i })).toBeInTheDocument();
  });

  it('opens picker input when toggle is clicked', async () => {
    render(<TransactionRow transaction={creditReimbursementNoLink} colCount={COL_COUNT} ... />);
    await userEvent.click(screen.getByRole('button', { name: /link to original expense/i }));
    expect(screen.getByPlaceholderText(/search expenses/i)).toBeInTheDocument();
  });

  it('calls onCategoryChange with offsetTransactionId when a DEBIT is selected from picker', async () => {
    const onCategoryChange = vi.fn();
    // mock searchDebitTransactions to return one result
    render(<TransactionRow transaction={creditReimbursementNoLink} onCategoryChange={onCategoryChange} colCount={COL_COUNT} ... />);
    await userEvent.click(screen.getByRole('button', { name: /link to original expense/i }));
    await userEvent.click(screen.getByText('Dinner at Restaurant')); // mocked result
    expect(onCategoryChange).toHaveBeenCalledWith(
      creditReimbursementNoLink.id,
      'Reimbursement',
      'Food & Dining',
      'debit-tx-id',
    );
  });

  it('shows linked transaction description and unlink button when already linked', () => {
    render(<TransactionRow transaction={creditReimbursementLinked} colCount={COL_COUNT} ... />);
    expect(screen.getByLabelText(/unlink expense/i)).toBeInTheDocument();
  });

  it('calls onCategoryChange with offsetTransactionId=null when unlink is clicked', async () => {
    const onCategoryChange = vi.fn();
    render(<TransactionRow transaction={creditReimbursementLinked} onCategoryChange={onCategoryChange} colCount={COL_COUNT} ... />);
    await userEvent.click(screen.getByLabelText(/unlink expense/i));
    expect(onCategoryChange).toHaveBeenCalledWith(
      creditReimbursementLinked.id,
      'Reimbursement',
      'Food & Dining',
      null,
    );
  });
});
```
