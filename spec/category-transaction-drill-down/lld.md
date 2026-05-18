# Category Transaction Drill-Down — Low Level Design

---

## Phase 1 — Category Link in Modal + Filter Display

### 1.1 Update MonthlyExpensesSummary Component

**File to modify:** `src/components/monthly-expenses/MonthlyExpensesSummary.tsx`

**Change:** Make category name in each row a clickable link.

```typescript
import Link from 'next/link';

// Inside the category rows loop:
export function CategoryRow({ categoryName, amount, month, year }: Props) {
  const categoryParam = encodeURIComponent(categoryName.toLowerCase());
  const href = `/cashflow/transactions?category=${categoryParam}&month=${month}&year=${year}`;

  return (
    <div className="flex items-center justify-between border-l-4 border-teal-500 px-4 py-3">
      <Link href={href} className="text-sm font-semibold text-teal-600 hover:underline dark:text-teal-400">
        {categoryName}
      </Link>
      <span className="text-lg font-bold text-gray-900 dark:text-white">
        ${amount.toFixed(2)}
      </span>
    </div>
  );
}
```

**Add transaction count badge (optional enhancement):**
```typescript
<Link href={href} className="flex items-center gap-2 text-sm font-semibold text-teal-600 hover:underline">
  {categoryName}
  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
    ({transactionCount})
  </span>
</Link>
```

---

### 1.2 Update TransactionsClient Page to Accept URL Params

**File to modify:** `src/app/(authorized)/cashflow/transactions/page.tsx` (the Server Component)

**Add:** Parse search params and pass to client component.

```typescript
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation'; // Client-side only

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function TransactionsPage({ searchParams }: Props) {
  const bankAccounts = await getBankAccounts(userId); // existing fetch

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TransactionsClient
        bankAccounts={bankAccounts}
        initialCategory={searchParams.category as string | undefined}
        initialMonth={searchParams.month ? parseInt(searchParams.month as string, 10) : undefined}
        initialYear={searchParams.year ? parseInt(searchParams.year as string, 10) : undefined}
      />
    </Suspense>
  );
}
```

---

### 1.3 Create CategoryTransactionFilters Component

**File to create:** `src/app/(authorized)/cashflow/transactions/_components/CategoryTransactionFilters.tsx`

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface CategoryTransactionFiltersProps {
  allCategories: Array<{ id: string; name: string }>;
  initialCategory?: string;
  initialMonth?: number;
  initialYear?: number;
  onFilterChange?: (filters: { category?: string; month?: number; year?: number }) => void;
}

export function CategoryTransactionFilters({
  allCategories,
  initialCategory,
  initialMonth,
  initialYear,
  onFilterChange,
}: CategoryTransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [month, setMonth] = useState<number | undefined>(initialMonth);
  const [year, setYear] = useState<number | undefined>(initialYear);

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value || undefined);
    onFilterChange?.({ category: value, month, year });
  }, [month, year, onFilterChange]);

  const handleMonthChange = useCallback((value: string) => {
    const m = value ? parseInt(value, 10) : undefined;
    setMonth(m);
    onFilterChange?.({ category, month: m, year });
  }, [category, year, onFilterChange]);

  const handleYearChange = useCallback((value: string) => {
    const y = value ? parseInt(value, 10) : undefined;
    setYear(y);
    onFilterChange?.({ category, month, year: y });
  }, [category, month, onFilterChange]);

  const handleReset = useCallback(() => {
    setCategory(undefined);
    setMonth(undefined);
    setYear(undefined);
    router.push('/cashflow/transactions');
    onFilterChange?.({ category: undefined, month: undefined, year: undefined });
  }, [router, onFilterChange]);

  // Build URL query string whenever filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', encodeURIComponent(category));
    if (month !== undefined) params.set('month', String(month));
    if (year !== undefined) params.set('year', String(year));

    const queryString = params.toString();
    if (queryString) {
      router.replace(`/cashflow/transactions?${queryString}`);
    } else {
      router.replace('/cashflow/transactions');
    }
  }, [category, month, year, router]);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
        {/* Category Filter */}
        <div>
          <label htmlFor="filter-category" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Category
          </label>
          <select
            id="filter-category"
            value={category || ''}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 
                       shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500
                       dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div>
          <label htmlFor="filter-month" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Month
          </label>
          <select
            id="filter-month"
            value={month || ''}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 
                       shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500
                       dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Months</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2025, m - 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div>
          <label htmlFor="filter-year" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Year
          </label>
          <select
            id="filter-year"
            value={year || ''}
            onChange={(e) => handleYearChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 
                       shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500
                       dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium 
                     text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Reset
        </button>
      </div>

      {/* Summary line */}
      {(category || month !== undefined || year !== undefined) && (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {category ? `${category}` : 'all categories'}
          {month !== undefined ? ` for ${new Date(2025, month - 1).toLocaleString('default', { month: 'long' })}` : ''}
          {year !== undefined ? ` ${year}` : ''}
        </div>
      )}
    </div>
  );
}
```

---

### 1.4 Create tRPC Router

**File to create:** `src/server/api/routers/category-transactions.ts`

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { Decimal } from '@prisma/client/runtime/library';

const GetByCategoryInputSchema = z.object({
  category: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2099),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type GetByCategoryInput = z.infer<typeof GetByCategoryInputSchema>;

export interface CategoryTransactionRow {
  id: string;
  date: string; // ISO date
  description: string;
  amount: number;
  category: string;
  source: string; // LLM_CLASSIFIED | USER_OVERRIDE
  status: string; // CONFIRMED
  bankAccountName: string | null;
}

export interface GetByCategoryOutput {
  transactions: CategoryTransactionRow[];
  category: string;
  month: number;
  year: number;
  total: number; // count
  totalAmount: number; // sum
  averageAmount: number;
}

export const categoryTransactionsRouter = createTRPCRouter({
  getByCategory: protectedProcedure
    .input(GetByCategoryInputSchema)
    .query(async ({ ctx, input }): Promise<GetByCategoryOutput> => {
      const userId = ctx.session.user.id;
      const { category, month, year, limit, offset } = input;

      // Build date range for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Query transactions
      const [transactions, total] = await Promise.all([
        ctx.db.transaction.findMany({
          where: {
            userId,
            type: 'DEBIT', // Only expenses
            status: 'CONFIRMED',
            category: { equals: category, mode: 'insensitive' },
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            bankAccount: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip: offset,
          take: limit,
        }),
        ctx.db.transaction.count({
          where: {
            userId,
            type: 'DEBIT',
            status: 'CONFIRMED',
            category: { equals: category, mode: 'insensitive' },
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      ]);

      // Calculate totals
      const totalAmount = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const averageAmount = total > 0 ? totalAmount / total : 0;

      return {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString().split('T')[0]!,
          description: tx.description,
          amount: Number(tx.amount),
          category: tx.category,
          source: tx.source,
          status: tx.status,
          bankAccountName: tx.bankAccount?.name ?? null,
        })),
        category,
        month,
        year,
        total,
        totalAmount: Number(totalAmount.toFixed(2)),
        averageAmount: Number(averageAmount.toFixed(2)),
      };
    }),
});
```

**File to modify:** `src/server/api/root.ts`

```typescript
import { categoryTransactionsRouter } from '@/server/api/routers/category-transactions';

export const appRouter = createTRPCRouter({
  // ... existing routers
  categoryTransactions: categoryTransactionsRouter,
});
```

---

### 1.5 Integrate Filters into TransactionsClient

**File to modify:** `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx`

```typescript
interface Props {
  bankAccounts: BankAccount[];
  initialCategory?: string;
  initialMonth?: number;
  initialYear?: number;
}

export default function TransactionsClient({
  bankAccounts,
  initialCategory,
  initialMonth,
  initialYear,
}: Props) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch all categories for the filter dropdown
  const { data: allCategories } = api.expenseCategory.getAll.useQuery();

  const handleImportComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Import cards (existing) */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* ... existing import cards ... */}
      </div>

      {/* Category Transaction Filters (NEW) */}
      {(initialCategory || initialMonth !== undefined || initialYear !== undefined) && (
        <div className="mt-10 border-b border-gray-200 pb-4 dark:border-gray-700">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Filtered View</h2>
          <CategoryTransactionFilters
            allCategories={allCategories ?? []}
            initialCategory={initialCategory}
            initialMonth={initialMonth}
            initialYear={initialYear}
          />
        </div>
      )}

      {/* Transaction Ledger Table */}
      <div className="mt-10">
        <TransactionLedgerTable
          bankAccounts={bankAccounts}
          refreshKey={refreshKey}
          initialCategory={initialCategory}
          initialMonth={initialMonth}
          initialYear={initialYear}
        />
      </div>

      <CSVImportWizard isOpen={csvOpen} onClose={() => setCsvOpen(false)} onImportComplete={handleImportComplete} />
      {/* ... rest of component */}
    </main>
  );
}
```

---

## Phase 2 — Enhanced TransactionLedgerTable with Category Filtering

### 2.1 Update TransactionLedgerTable to Accept Category Filter

**File to modify:** `src/components/transactions/TransactionLedgerTable.tsx`

```typescript
interface TransactionLedgerTableProps {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  refreshKey?: number;
  initialCategory?: string;
  initialMonth?: number;
  initialYear?: number;
}

export default function TransactionLedgerTable({
  bankAccounts,
  refreshKey = 0,
  initialCategory,
  initialMonth,
  initialYear,
}: TransactionLedgerTableProps) {
  // If category/month are provided, use them; otherwise, fall back to existing ledger behavior
  const isCategoryFilterActive = !!(initialCategory && initialMonth !== undefined);

  if (isCategoryFilterActive) {
    return <CategoryFilteredLedger category={initialCategory} month={initialMonth!} year={initialYear} />;
  }

  // Otherwise, show full ledger (existing behavior)
  return <FullLedger refreshKey={refreshKey} />;
}
```

### 2.2 Create CategoryFilteredLedger Component

```typescript
function CategoryFilteredLedger({ category, month, year }: { category: string; month: number; year?: number }) {
  const currentYear = new Date().getFullYear();
  const effectiveYear = year ?? currentYear;

  const { data, isLoading } = api.categoryTransactions.getByCategory.useQuery({
    category,
    month,
    year: effectiveYear,
    limit: 100,
    offset: 0,
  });

  if (isLoading) return <div className="py-8 text-center">Loading...</div>;
  if (!data) return <div className="py-8 text-center text-red-500">Error loading transactions</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {data.category} — {new Date(effectiveYear, data.month - 1).toLocaleString('default', { month: 'long' })} {effectiveYear}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {data.total} transaction{data.total !== 1 ? 's' : ''} • Total: ${data.totalAmount.toFixed(2)} • Avg: ${data.averageAmount.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border-b border-gray-200 px-4 py-2 text-left font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
                Date
              </th>
              <th className="border-b border-gray-200 px-4 py-2 text-left font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
                Description
              </th>
              <th className="border-b border-gray-200 px-4 py-2 text-right font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
                Amount
              </th>
              <th className="border-b border-gray-200 px-4 py-2 text-left font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
                Account
              </th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{tx.date}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{tx.description}</td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                  ${tx.amount.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {tx.bankAccountName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Test Cases

| Test | Type | What it Verifies |
|---|---|---|
| User clicks category in modal | E2E | Navigation to `/cashflow/transactions?category=groceries&month=02` works |
| URL params populate filters | Unit | CategoryTransactionFilters reads initialCategory, initialMonth from props |
| Query returns correct transactions | Integration | `categoryTransactions.getByCategory()` filters by category + month + status=CONFIRMED + type=DEBIT |
| Sum of transactions matches modal | Integration | Total amount in drill-down equals category total from MonthlyExpenseSummary |
| Reset button clears filters | Unit | Clicking reset navigates to `/cashflow/transactions` (no params) |
| Category case-insensitive match | Unit | Query with "GROCERIES" matches "groceries" category |
| Month boundary dates correct | Unit | Month=2 query includes all of Feb (1st–28th) |
| Empty result set handled | Unit | No transactions for category/month shows empty table with 0 count |

---

## Implementation Order

1. **Phase 1a** — Update `MonthlyExpensesSummary` to make categories clickable links
2. **Phase 1b** — Create `categoryTransactionsRouter.getByCategory` + register in root
3. **Phase 1c** — Create `CategoryTransactionFilters` component
4. **Phase 1d** — Update `TransactionsClient` to accept initial category/month params and render filters
5. **Phase 1e** — Update `TransactionsPage` to parse search params and pass to client
6. **Phase 2a** — Update `TransactionLedgerTable` to detect category filter and show filtered view
7. **Phase 2b** — Create `CategoryFilteredLedger` subcomponent with dedicated table

