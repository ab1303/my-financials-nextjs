# Bank Account Filter Parity — Implementation Detail

## Component Architecture

### 1. Shared Bank Account Selector Component

**File**: `src/components/CashflowBankSelector.tsx`

```typescript
interface CashflowBankSelectorProps {
  selectedBankAccountId: string | null;
  onBankChange: (bankAccountId: string | null) => void;
  showAllOption?: boolean;
}

export const CashflowBankSelector: React.FC<CashflowBankSelectorProps> = ({
  selectedBankAccountId,
  onBankChange,
  showAllOption = true,
}) => {
  const { data: accounts } = useTRPC_getFinancialAccounts(); // New query
  
  return (
    <Select
      options={accounts.map(acc => ({ 
        value: acc.id, 
        label: `${acc.name} (${acc.institutionName})` 
      }))}
      isMulti={false}
      isClearable={showAllOption}
      onChange={(opt) => onBankChange(opt?.value ?? null)}
      value={selectedBankAccountId ? { value: selectedBankAccountId, label: "..." } : null}
      // ... dark mode classNames
    />
  );
};
```

**Tooltip** (in parent page):
```
"Bank filter applies to imported transactions only. Manual entries always shown."
```

---

## Service Layer & Data Handler Changes

### Income Page

**Current file**: `src/server/api/routers/incomeRouter.ts`

#### `getIncomeEntries` handler

```typescript
input: z.object({
  year: z.number(),
  month: z.number(),
  bankAccountId: z.string().nullable(), // ← NEW parameter
}),

async execute({ year, month, bankAccountId }) {
  const query = prisma.incomeEntry.findMany({
    where: {
      userId: session.userId,
      date: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(month === 12 ? year + 1 : year, month % 12, 1),
      },
      // ← NEW: Apply bank filter OR include manual entries
      OR: [
        bankAccountId ? { transaction: { bankAccountId } } : {},
        { source: { in: ['MANUAL', 'USER_MANUAL'] } },
      ].filter(Boolean),
    },
    include: { transaction: true },
  });
  
  return query;
}
```

#### `getTotalIncome` handler

```typescript
input: z.object({
  year: z.number(),
  bankAccountId: z.string().nullable(), // ← NEW parameter
}),

async execute({ year, bankAccountId }) {
  // Same filtering logic as getIncomeEntries (annual scope)
}
```

### Expense Page

**Current file**: `src/server/api/routers/expenseRouter.ts`

#### `getExpenseEntriesForMonth` handler

```typescript
input: z.object({
  year: z.number(),
  month: z.number(),
  bankAccountId: z.string().nullable(), // ← NEW parameter
}),

async execute({ year, month, bankAccountId }) {
  // Same OR logic as Income (bankAccountId filter OR manual source)
}
```

#### `getTotalExpenses` handler

```typescript
input: z.object({
  year: z.number(),
  bankAccountId: z.string().nullable(), // ← NEW parameter
}),

async execute({ year, bankAccountId }) {
  // Same OR logic as Income (annual scope)
}
```

### Bank Interest Page

**Current file**: `src/server/api/routers/bankInterestRouter.ts`

#### `getBankInterest` handler

```typescript
input: z.object({
  year: z.number(),
  bankAccountId: z.string().nullable(), // ← Change from institutionId to bankAccountId
}),

async execute({ year, bankAccountId }) {
  const query = prisma.bankInterest.findMany({
    where: {
      userId: session.userId,
      date: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
      // ← Use FinancialAccount.id directly, no Business lookup needed
      ...(bankAccountId && { financialAccountId: bankAccountId }),
    },
  });
  
  return query;
}
```

---

## New tRPC Query

### `getFinancialAccounts`

**File**: `src/server/api/routers/financialAccountRouter.ts` (new or existing)

```typescript
export const getFinancialAccounts = protectedProcedure
  .query(async ({ ctx }) => {
    return prisma.financialAccount.findMany({
      where: { userId: ctx.session.userId, isTracked: true },
      include: {
        institution: { select: { name: true } }, // Business table
      },
      orderBy: { name: 'asc' },
    });
  });
```

Returns: `{ id, name, institutionName }[]`

---

## UI/Client Component Changes

### Income Page (`src/app/(authenticated)/(dashboard)/income/page.tsx`)

```typescript
'use client';

const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);

const { data: incomeData } = trpc.income.getIncomeEntries.useQuery({
  year: calendarYear,
  month: currentMonth,
  bankAccountId: selectedBankAccountId, // ← Pass to handler
});

const { data: totalIncome } = trpc.income.getTotalIncome.useQuery({
  year: calendarYear,
  bankAccountId: selectedBankAccountId, // ← Pass to handler
});

return (
  <div>
    <div className="flex items-center justify-between">
      <h1>Income</h1>
      <CashflowBankSelector
        selectedBankAccountId={selectedBankAccountId}
        onBankChange={setSelectedBankAccountId}
      />
    </div>
    
    <div className="text-xs text-gray-500 dark:text-gray-400">
      Bank filter applies to imported transactions only. Manual entries always shown.
    </div>
    
    {/* Rest of page uses incomeData, totalIncome */}
  </div>
);
```

### Expense Page (`src/app/(authenticated)/(dashboard)/expenses/page.tsx`)

Same pattern as Income page (pass `bankAccountId` to handlers, add tooltip).

### Bank Interest Page (`src/app/(authenticated)/(dashboard)/bank-interest/page.tsx`)

Same pattern (replace Business-based dropdown with CashflowBankSelector, pass `bankAccountId` directly).

---

## File Inventory

| File Path | Change | Notes |
|-----------|--------|-------|
| `src/components/CashflowBankSelector.tsx` | CREATE | Shared component, reusable across cashflow pages |
| `src/server/api/routers/incomeRouter.ts` | EDIT | Add `bankAccountId` parameter to `getIncomeEntries`, `getTotalIncome` |
| `src/server/api/routers/expenseRouter.ts` | EDIT | Add `bankAccountId` parameter to `getExpenseEntriesForMonth`, `getTotalExpenses` |
| `src/server/api/routers/bankInterestRouter.ts` | EDIT | Replace `institutionId` with `bankAccountId` in `getBankInterest` |
| `src/server/api/routers/financialAccountRouter.ts` | EDIT/CREATE | Add `getFinancialAccounts` query |
| `src/app/.../income/page.tsx` | EDIT | Add bank selector, pass `bankAccountId` to queries |
| `src/app/.../expenses/page.tsx` | EDIT | Add bank selector, pass `bankAccountId` to queries |
| `src/app/.../bank-interest/page.tsx` | EDIT | Replace Business dropdown with CashflowBankSelector |
| `src/app/.../income/form.tsx` | REVIEW | Verify no breaking changes to props |
| `src/app/.../expenses/form.tsx` | REVIEW | Verify no breaking changes to props |

---

## Data Filtering Logic (Core Pattern)

### For pages with bankAccountId filter:

```sql
-- Show imported transactions matching the selected bank
SELECT * FROM IncomeEntry
WHERE userId = ? AND year/month = ? AND transaction.bankAccountId = ?

UNION

-- Always show manual entries (they have bankAccountId = null)
SELECT * FROM IncomeEntry
WHERE userId = ? AND year/month = ? AND source IN ('MANUAL', 'USER_MANUAL')
```

In Prisma:
```typescript
where: {
  userId: session.userId,
  date: { /* date range */ },
  OR: [
    bankAccountId ? { transaction: { bankAccountId } } : {},
    { source: { in: ['MANUAL', 'USER_MANUAL'] } },
  ].filter(Boolean),
}
```

---

## Acceptance Criteria

✅ **Bank selector displays user's FinancialAccount records** (not global Business banks)  
✅ **Income page filters correctly**: Displays imported entries for selected bank + all manual entries  
✅ **Expense page filters correctly**: Displays imported entries for selected bank + all manual entries  
✅ **Bank Interest page uses FinancialAccount.id**: No Business/institutionId lookup  
✅ **Manual entries always visible**: Regardless of bank filter selection  
✅ **Tooltip present on all pages**: Explains filter scope  
✅ **All queries include bankAccountId parameter**: Passed from UI to handlers  
✅ **Behavior consistent**: Same pattern across Income, Expense, Bank Interest  
✅ **No regression**: Transaction Ledger continues to work as-is

---

## Implementation Notes

- **Shared component**: `CashflowBankSelector` ensures consistency across pages
- **Nullable `bankAccountId`**: Represents "show all" state (no filter applied)
- **Filter OR logic**: Ensures manual entries always appear, avoiding data loss illusion
- **Tooltip messaging**: Critical to communicate that filter applies only to imported transactions
- **tRPC safety**: New query and parameter additions maintain type safety across client/server boundary
