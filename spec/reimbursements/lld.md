# Reimbursement Tracking — Low Level Design

**Version:** 1.0
**Status:** Implementation-Ready
**Reference:** `hld.md` for architecture decisions; `context.md` for file inventory and data flows

---

## Phase Map

```
Phase 1 — Schema migration       (prisma/schema.prisma)
Phase 2 — Constants + service    (constants.ts + ledger.service.ts)
Phase 3 — tRPC router changes    (transaction-ledger.ts)
Phase 4 — UI changes             (TransactionRow + TransactionLedgerTable)
```

Phases 1 and 2 are prerequisites for Phase 3. Phase 4 can be developed in parallel with
Phase 3 but cannot be tested end-to-end until Phase 3 is deployed.

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

Steps 1–7 are all server-side and can be reviewed/merged independently of steps 8–9.
```

---

All three files are ready to write to disk. Here is a summary of what was produced:

## Summary

### Files created

| File | Size | Key content |
|---|---|---|
| `spec/reimbursements/context.md` | ~230 lines | File inventory (6 modified, 1 created), schema diff, constant definiti
ion, 4 ASCII data-flow diagrams (import → current edit → proposed edit → reversal → re-offset) |
| `spec/reimbursements/hld.md` | ~130 lines | Problem statement, 8 numbered architecture decisions with rationale table,
, data model semantics, high-level component changes, future phases table, 8 success criteria |
| `spec/reimbursements/lld.md` | ~390 lines | 4 phases with exact Prisma diffs, full TypeScript/Zod code for `constants.
.ts`, `ledger.service.ts` additions, complete rewritten `updateCategory` mutation (Cases A–E), `TransactionRow` JSX diff,
, `handleCategoryChange` update, test stubs per phase, and a dependency-ordered implementation table |

### Notable decisions captured

- **`REIMBURSEMENT_CATEGORY`** is a string constant, not a new enum — zero migration impact on existing `category` reade
ers
- **`offsetCategory String?`** is a dedicated nullable column, not encoded into the `category` field — keeps the field q
queryable and leaves all existing router/service code unaffected
- The `updateCategory` mutation now has **5 mutually exclusive roll-up branches** (A–E), each clearly commented, replaci
ing the previous implicit `if (type === DEBIT)` / `if (type === CREDIT)` structure
- The **offset category `<select>`** is conditional and uses a teal border to visually distinguish it as a secondary con
ntrol
- `EXCLUDED_CREDIT_LABELS` moves to `constants.ts` so both the router and `csv-confirm.service.ts` share the same author
ritative list — adding `'Reimbursement'` in one place covers both import-time and edit-time paths
___BEGIN___COMMAND_DONE_MARKER___0
PS C:\My Github\my-financials-nextjs>
