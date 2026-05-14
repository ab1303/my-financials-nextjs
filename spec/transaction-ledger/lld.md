# Transaction Ledger — Low Level Design

---

## Phase 1 — Read-Only Ledger Table

### 1.1 tRPC Router

**File to create:** `src/server/api/routers/transaction-ledger.ts`

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
  dateFrom:      z.string().optional(), // ISO date string YYYY-MM-DD
  dateTo:        z.string().optional(),
  search:        z.string().optional(),
});

export type GetAllInput = z.infer<typeof GetAllInputSchema>;

export interface TransactionRow {
  id:              string;
  date:            string;           // ISO date string
  description:     string;
  amount:          number;
  type:            TransactionTypeEnum;
  category:        string;
  source:          string;           // LLM_CLASSIFIED | USER_OVERRIDE
  status:          TransactionStatusEnum;
  bankAccountId:   string | null;
  bankAccountName: string | null;
  bankName:        string | null;
  importSessionId: string | null;
  createdAt:       string;
}

export interface GetAllOutput {
  transactions: TransactionRow[];
  total:        number;
  page:         number;
  totalPages:   number;
  // For category dropdowns:
  expenseCategories:   Array<{ id: string; name: string }>;
  incomeSourceLabels:  string[];  // IncomeSourceEnumType values
}

export const transactionLedgerRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(GetAllInputSchema)
    .query(async ({ ctx, input }): Promise<GetAllOutput> => {
      const userId = ctx.session.user.id;
      const { page, limit, type, status, bankAccountId, dateFrom, dateTo, search } = input;

      const where = {
        userId,
        ...(type          && { type }),
        ...(status        && { status }),
        ...(bankAccountId && { bankAccountId }),
        ...(dateFrom || dateTo) && {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59Z') }),
          },
        },
        ...(search && {
          description: { contains: search, mode: 'insensitive' as const },
        }),
      };

      const [transactions, total, expenseCategories] = await Promise.all([
        ctx.db.transaction.findMany({
          where,
          include: { bankAccount: { select: { name: true, bankName: true } } },
          orderBy: { date: 'desc' },
          skip:  (page - 1) * limit,
          take:  limit,
        }),
        ctx.db.transaction.count({ where }),
        ctx.db.expenseCategory.findMany({
          where:   { isActive: true },
          select:  { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      return {
        transactions: transactions.map((tx) => ({
          id:              tx.id,
          date:            tx.date.toISOString().split('T')[0]!,
          description:     tx.description,
          amount:          Number(tx.amount),
          type:            tx.type,
          category:        tx.category,
          source:          tx.source,
          status:          tx.status,
          bankAccountId:   tx.bankAccountId ?? null,
          bankAccountName: tx.bankAccount?.name ?? null,
          bankName:        tx.bankAccount?.bankName ?? null,
          importSessionId: tx.importSessionId ?? null,
          createdAt:       tx.createdAt.toISOString(),
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        expenseCategories,
        incomeSourceLabels: ['EMPLOYMENT','STOCKS','BONDS','RENTAL','BUSINESS','FREELANCE','DIVIDEND','OTHER'],
      };
    }),
});
```

**File to modify:** `src/server/api/root.ts`
```typescript
import { transactionLedgerRouter } from '@/server/api/routers/transaction-ledger';
// add to appRouter:
transactionLedger: transactionLedgerRouter,
```

---

### 1.2 TransactionLedgerTable Component

**File to create:** `src/components/transactions/TransactionLedgerTable.tsx`

```typescript
'use client';

import { useState, useCallback } from 'react';
import { api } from '@/utils/api';
import type { TransactionTypeEnum, TransactionStatusEnum } from '@prisma/client';

type TabFilter = 'all' | 'expenses' | 'income' | 'excluded';

const TAB_TO_PARAMS: Record<TabFilter, { type?: TransactionTypeEnum; status?: TransactionStatusEnum }> = {
  all:      {},
  expenses: { type: 'DEBIT',  status: 'CONFIRMED' },
  income:   { type: 'CREDIT', status: 'CONFIRMED' },
  excluded: {                  status: 'EXCLUDED'  },
};
```

**Props interface:**
```typescript
interface TransactionLedgerTableProps {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
}
```

**State:**
```typescript
const [activeTab,      setActiveTab]      = useState<TabFilter>('all');
const [page,           setPage]           = useState(1);
const [bankAccountId,  setBankAccountId]  = useState<string | undefined>();
const [dateFrom,       setDateFrom]       = useState<string | undefined>();
const [dateTo,         setDateTo]         = useState<string | undefined>();
const [search,         setSearch]         = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
```

**tRPC query:**
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

**Table columns:** Date | Description | Amount | Type | Category | Source | Status | Bank Account

**Expose `refetch` via `useImperativeHandle`** or accept a `refreshKey: number` prop that changes when import completes (simpler).

---

### 1.3 Integration into TransactionsClient

**File to modify:** `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx`

```typescript
interface Props {
  bankAccounts: BankAccount[];
}

export default function TransactionsClient({ bankAccounts }: Props) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [aiOpen,  setAiOpen]  = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      {/* existing import cards */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">...</div>

      {/* NEW: ledger table */}
      <div className="mt-10">
        <TransactionLedgerTable
          bankAccounts={bankAccounts}
          refreshKey={refreshKey}
        />
      </div>

      <CSVImportWizard
        isOpen={csvOpen}
        onClose={() => setCsvOpen(false)}
        bankAccounts={bankAccounts}
        onImportComplete={handleImportComplete}   // ← wire up
      />
      ...
    </main>
  );
}
```

**File to modify:** `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx`
- `CSVImportWizardProps` already has `onImportComplete?: () => void`
- Ensure it is called inside `handleConfirmComplete` after the results step closes

---

## Phase 2 — Inline Category Editing

### 2.1 tRPC Mutation

Add to `src/server/api/routers/transaction-ledger.ts`:

```typescript
const UpdateCategoryInputSchema = z.object({
  id:          z.string().min(1),
  newCategory: z.string().min(1),
});

updateCategory: protectedProcedure
  .input(UpdateCategoryInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    const tx = await ctx.db.transaction.findUnique({ where: { id: input.id } });
    if (!tx || tx.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    const updated = await ctx.db.transaction.update({
      where: { id: input.id },
      data: {
        category: input.newCategory,
        source:   'USER_OVERRIDE',
      },
    });

    // Re-rollup expense summary for DEBIT transactions
    if (tx.type === 'DEBIT' && tx.status === 'CONFIRMED' && tx.category !== input.newCategory) {
      await rerollupExpenseSummary({
        userId,
        oldCategory: tx.category,
        newCategory: input.newCategory,
        amount:      tx.amount,
        date:        tx.date,
      });
    }

    // Update IncomeRecord source for CREDIT transactions
    if (tx.type === 'CREDIT' && tx.status === 'CONFIRMED' && tx.category !== input.newCategory) {
      await updateIncomeRecordSource({
        userId,
        newSource:       input.newCategory as IncomeSourceEnumType,
        amount:          tx.amount,
        transactionDate: tx.date,
      });
    }

    return updated;
  }),
```

### 2.2 Re-rollup Service

**File to create:** `src/server/services/transactions/ledger.service.ts`

```typescript
async function rerollupExpenseSummary(params: {
  userId:      string;
  oldCategory: string;
  newCategory: string;
  amount:      Decimal;
  date:        Date;
}): Promise<void> {
  const monthNum = params.date.getMonth() + 1;
  const calendar = await prisma.calendarYear.findFirst({ where: { type: 'FISCAL' } });
  if (!calendar) throw new Error('No fiscal calendar found');

  const ledger = await prisma.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendar.id, userId: params.userId } },
  });
  if (!ledger) return; // no ledger = no rollup to fix

  const [oldCat, newCat] = await Promise.all([
    prisma.expenseCategory.findFirst({ where: { name: params.oldCategory, isActive: true } }),
    prisma.expenseCategory.findFirst({ where: { name: params.newCategory, isActive: true } }),
  ]);

  // Decrement old category
  if (oldCat) {
    await prisma.monthlyExpenseSummary.updateMany({
      where: { expenseLedgerId: ledger.id, categoryId: oldCat.id, month: monthNum },
      data:  { amount: { decrement: params.amount } },
    });
  }

  // Increment new category (upsert)
  if (newCat) {
    const existing = await prisma.monthlyExpenseSummary.findFirst({
      where: { expenseLedgerId: ledger.id, categoryId: newCat.id, month: monthNum },
    });
    if (existing) {
      await prisma.monthlyExpenseSummary.update({
        where: { id: existing.id },
        data:  { amount: { increment: params.amount } },
      });
    } else {
      await prisma.monthlyExpenseSummary.create({
        data: { month: monthNum, amount: params.amount, categoryId: newCat.id, expenseLedgerId: ledger.id },
      });
    }
  }
}

async function updateIncomeRecordSource(params: {
  userId:          string;
  newSource:       IncomeSourceEnumType;
  amount:          Decimal;
  transactionDate: Date;
}): Promise<void> {
  // Match IncomeRecord by userId (via ledger), dateEarned, and amount
  // Note: this is best-effort — duplicate amounts on same day will update first match only
  const calendar = await prisma.calendarYear.findFirst({ where: { type: 'FISCAL' } });
  if (!calendar) return;

  const ledger = await prisma.incomeLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendar.id, userId: params.userId } },
  });
  if (!ledger) return;

  const record = await prisma.incomeRecord.findFirst({
    where: {
      incomeLedgerId: ledger.id,
      dateEarned:     params.transactionDate,
      amount:         String(params.amount),
    },
  });

  if (record) {
    await prisma.incomeRecord.update({
      where: { id: record.id },
      data:  { source: params.newSource },
    });
  }
}
```

### 2.3 Inline Edit in TransactionRow

```typescript
// Inside TransactionRow, the category cell:
<td className="py-3 px-4">
  <select
    value={transaction.category}
    onChange={(e) => onCategoryChange(transaction.id, e.target.value)}
    className="w-full min-w-[140px] rounded border border-gray-300 bg-transparent px-2 py-1 text-sm
               text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white
               focus:outline-none focus:ring-2 focus:ring-teal-500"
  >
    {/* render expense categories for DEBIT, income labels for CREDIT */}
    {transaction.type === 'DEBIT'
      ? expenseCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)
      : incomeSourceLabels.map((l) => <option key={l} value={l}>{l}</option>)
    }
  </select>
</td>
```

### 2.4 Schema Migration (future)

To make IncomeRecord matching reliable, add:
```prisma
model IncomeRecord {
  ...
  transactionId String?    @unique
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
}
```
Migration name: `add_income_record_transaction_fk`
This is **not required for Phase 2** but recommended before Phase 3.

---

## Phase 3 — Filtering & Search

### 3.1 Filter Bar Component

**File to create:** `src/components/transactions/TransactionFilters.tsx`

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

**Controls:**
- Bank account `<select>` (All accounts + each account)
- Date from/to `<input type="date">`
- Description search `<input type="text">` (300ms debounce via `useEffect`)
- Reset button

### 3.2 URL Search Params (optional enhancement)

Use `useSearchParams` + `useRouter` from `next/navigation` to persist filters in URL:
```
/cashflow/transactions?tab=expenses&from=2025-07-01&to=2025-07-31&q=salary
```
Allows bookmark/share of filtered views. Tab changes push to router; filter changes use `router.replace`.

---

## Implementation Order

1. **Phase 1a** — tRPC router `getAll` + register in root
2. **Phase 1b** — `TransactionLedgerTable` (read-only, no edit)
3. **Phase 1c** — Wire `refreshKey` through `TransactionsClient` → `CSVImportWizard.onImportComplete`
4. **Phase 2a** — `updateCategory` mutation + `ledger.service.ts`
5. **Phase 2b** — Inline edit dropdown in `TransactionRow`
6. **Phase 3** — `TransactionFilters` component + URL param persistence
