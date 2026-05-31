# Expense Tracking — Low-Level Design

## Year & Bank Filter Patterns (do not regress)

### Year Type Selector: `CalendarYearPicker`
The Expense page uses the same shared `CalendarYearPicker` as Income — **do not replace with a plain `Select`**:

```tsx
<CalendarYearPicker
  applicableTypes={['FISCAL', 'ANNUAL']}
  calendarYears={expenseYearData}
  selectedYearId={yearIdParam || undefined}
  defaultType={defaultCalendarType}   // from getUserFiscalYearType()
  onYearChange={handleYearChange}
/>
```

- `defaultCalendarType` is fetched server-side via `getUserFiscalYearType(prisma, userId)`.
- Year URL param is `year` (stores `CalendarYear.id` as a string) — **not** `fromYear`/`toYear`.
- `getCalendarYearsHandler(['FISCAL', 'ANNUAL'])` fetches all years; `CalendarYearPicker` filters internally.
- Default year selected via `getDefaultCalendarYear(expenseYearData, fiscalYearType)`.

### Bank Account Filter
- URL param: `bank` (stores `FinancialAccount.id`).
- Bank options loaded via `listBankAccountsHandler(userId)` → returns `{ id, name, institution: { name } }[]`.
- Option label: `` `${a.name} (${a.institution.name})` ``.
- When a bank is selected, service queries: `OR: [{ bankAccountId }, { source: 'USER_MANUAL' }]` — manual entries always included.

### URL Param Pattern (`expense/form.tsx`)
```ts
const updateURLSearchParams = (key: 'year' | 'bank', value?: string) => {
  const current = new URLSearchParams(searchParams?.toString() ?? '');
  if (!value) current.delete(key);
  else current.set(key, value);
  const search = current.toString();
  router.replace(`${pathname}${search ? `?${search}` : ''}`);
};
```

---

# Expense Tracking — Low-Level Design

## Year & Bank Filter Patterns (do not regress)

### Year Type Selector: `CalendarYearPicker`
The Expense page uses the same shared `CalendarYearPicker` as Income — **do not replace with a plain `Select`**:

```tsx
<CalendarYearPicker
  applicableTypes={['FISCAL', 'ANNUAL']}
  calendarYears={expenseYearData}
  selectedYearId={yearIdParam || undefined}
  defaultType={defaultCalendarType}   // from getUserFiscalYearType()
  onYearChange={handleYearChange}
/>
```

- `defaultCalendarType` is fetched server-side via `getUserFiscalYearType(prisma, userId)`.
- Year URL param is `year` (stores `CalendarYear.id` as a string) — **not** `fromYear`/`toYear`.
- `getCalendarYearsHandler(['FISCAL', 'ANNUAL'])` fetches all years; `CalendarYearPicker` filters internally.
- Default year selected via `getDefaultCalendarYear(expenseYearData, fiscalYearType)`.

### Bank Account Filter
- URL param: `bank` (stores `FinancialAccount.id`).
- Bank options loaded via `listBankAccountsHandler(userId)` → returns `{ id, name, institution: { name } }[]`.
- Option label: `` `${a.name} (${a.institution.name})` ``.
- When a bank is selected, service queries: `OR: [{ bankAccountId }, { source: 'USER_MANUAL' }]` — manual entries always included.

### URL Param Pattern (`expense/form.tsx`)
```ts
const updateURLSearchParams = (key: 'year' | 'bank', value?: string) => {
  const current = new URLSearchParams(searchParams?.toString() ?? '');
  if (!value) current.delete(key);
  else current.set(key, value);
  const search = current.toString();
  router.replace(`${pathname}${search ? `?${search}` : ''}`);
};
```

---

## Phase: Yearly Category Breakdown Widget

### Problem
The current Expense page shows only a single "Total Expenses: $X" figure. Users have no visibility into **where** their money went at a glance — the only way to see category splits is opening the per-month breakdown modal. This is the same gap the `SourceBreakdownWidget` solves on the Income page.

### UX Design

Mirrors the Income `SourceBreakdownWidget` but adapts for 20+ expense categories:

```
┌─────────────────────────────────────────────────────────────────┐
│  [████████████████ Shopping ██ Groceries ████ Home ████ ...    ]│  ← proportional stacked bar (all categories)
│                                                                   │
│  🔴 Shopping $28,440 (19.8%) ↗  🟠 Groceries $22,100 (15.4%) ↗ │  ← Top 5 clickable badges
│  🟡 Home $18,300 (12.7%) ↗     🔵 Vehicle $12,600 (8.8%) ↗     │
│  🟣 Utilities $9,200 (6.4%) ↗                                    │
│  + 9 more categories ▾                                           │  ← collapsed by default
│  [Health $7,800 (5.4%) ↗  Education $6,200 (4.3%) ↗  ...]       │  ← expands inline
└─────────────────────────────────────────────────────────────────┘
```

**Rules:**
1. Proportional stacked color bar renders ALL categories (not just top 5)
2. Legend shows the **top 5 by spend** by default
3. A `+ N more` toggle expands/collapses the remaining categories inline — no navigation or modal
4. Clicking any badge navigates to the filtered Transactions ledger (expenses tab, category filter, date range)
5. When all categories fit within 5, the toggle is not rendered
6. Widget renders `null` when there are no expense entries

### Transaction Drill-through URL
```
/cashflow/transactions?tab=expenses&categoryName=<encodedName>&dateFrom=<YYYY-MM-DD>&dateTo=<YYYY-MM-DD>
```

This reuses the same deep-link pattern as `SourceBreakdownWidget` but targets `tab=expenses`.

### Color Palette
With 20+ categories a static name→color map is impractical. Use a **fixed ordered palette** assigned by rank (highest spend → color index 0). The palette must have dark-mode variants:

```typescript
// EXPENSE_CATEGORY_COLORS[i] — assigned to the i-th category sorted by spend desc
const EXPENSE_CATEGORY_COLORS = [
  'bg-red-500',    'bg-orange-500', 'bg-amber-500',  'bg-yellow-500',
  'bg-lime-500',   'bg-green-500',  'bg-emerald-500','bg-teal-500',
  'bg-cyan-500',   'bg-sky-500',    'bg-blue-500',   'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500','bg-pink-500',
  'bg-rose-500',   'bg-slate-500',  'bg-zinc-500',   'bg-stone-500',
];
// Badge bg uses opacity-20 equivalent: use Tailwind bg-<color>-100 dark:bg-<color>-900/40
```

### Data Shape
New type `CategoryBreakdown` (already exists in `src/server/models/expense.ts`):
```typescript
type CategoryBreakdown = {
  categoryName: string;
  total: number;
  percentage: number;
};
```

### Service Layer
New function in `expense.service.ts`:

```typescript
export const getCategoryBreakdownForYear = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
): Promise<CategoryBreakdown[]>
```

- Queries all `DEBIT CONFIRMED` transactions for the calendar year's date window
- Excludes `TRANSFER_CATEGORY`
- Respects `bankAccountId` filter: `OR: [{ bankAccountId }, { source: 'USER_MANUAL' }]`
- Groups by `transaction.category`, sums amounts
- Returns sorted by total descending with percentage

> **Note:** Do NOT duplicate the date-window derivation logic — reuse the same pattern as `getMonthlyExpenseSummaries` (look up calendarYear, derive startDate/endDate).

### Controller Layer
Extend `getExpenseDataHandler` return type to include `categoryBreakdown`:

```typescript
return {
  calendarId: calendarYearId,
  userId,
  monthlySummaries,
  totalAmount,
  categoryBreakdown,   // ← new
};
```

Alternatively, a separate `getExpenseCategoryBreakdownHandler(calendarYearId, userId, bankAccountId?)` called in parallel from `ExpenseTableServer` — preferred to keep `getExpenseDataHandler` focused.

### Component: `ExpenseCategoryBreakdownWidget`

Location: `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx`

Client component (`'use client'`). Props:

```typescript
type Props = {
  breakdown: CategoryBreakdown[];   // sorted by total desc (from server)
  yearDateFrom: string;             // YYYY-MM-DD
  yearDateTo: string;               // YYYY-MM-DD
  topN?: number;                    // default 5
};
```

Internal state: `expanded: boolean` (default `false`).

Render structure:
```tsx
<div className='mb-4 rounded-lg border border-border bg-card/50 p-3'>
  {/* Stacked proportional bar */}
  <div className='flex h-2 w-full overflow-hidden rounded-full bg-muted'>
    {breakdown.map((item, i) => <div style={{ width: `${item.percentage}%` }} className={COLORS[i]} />)}
  </div>
  {/* Legend — top N visible */}
  <div className='mt-2 flex flex-wrap gap-3'>
    {visibleItems.map(item => <CategoryBadgeLink ... />)}
    {hiddenCount > 0 && <ExpandToggle count={hiddenCount} expanded={expanded} onToggle={...} />}
    {expanded && hiddenItems.map(item => <CategoryBadgeLink ... />)}
  </div>
</div>
```

### Rendering in Page
`ExpenseTableServer` calls `getCategoryBreakdownForYear` in parallel with `getMonthlyExpenseSummaries`. Passes `breakdown`, `dateFrom`, `dateTo` as strings to `ExpenseCategoryBreakdownWidget`, rendered above the monthly table — **between** the `Total Expenses` banner and the month rows.

---

## File Inventory

| File | Role |
|------|------|
| `src/app/(authorized)/cashflow/expense/page.tsx` | Server page — loads years, bank accounts, session; derives selected year and bank; renders `ExpenseForm` + `ExpenseTableServer` |
| `src/app/(authorized)/cashflow/expense/form.tsx` | Client component — `CalendarYearPicker` + bank `Select`; manages URL params `year` and `bank` |
| `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` | Server component — receives `calendarYearId`, `bankAccountId?`, date range; calls `getExpenseDataHandler` + `getExpenseCategoryBreakdownHandler` |
| `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Client component — receives `categoryBreakdown` + `dateFrom`/`dateTo` strings; renders `ExpenseCategoryBreakdownWidget` above monthly table |
| `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx` | **New** — client component; stacked bar + top-5 legend + expand toggle + drill-through links |
| `src/server/controllers/expense.controller.ts` | Add `getExpenseCategoryBreakdownHandler(calendarYearId, userId, bankAccountId?)` |
| `src/server/services/expense.service.ts` | Add `getCategoryBreakdownForYear(calendarYearId, userId, bankAccountId?)` |

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | Widget renders between the "Total Expenses" banner and the monthly table |
| 2 | Proportional color bar spans 100% width with all categories represented |
| 3 | Top 5 categories shown by default, sorted by spend descending |
| 4 | "+ N more" toggle appears only when there are more than 5 categories |
| 5 | Clicking toggle expands remaining categories inline (no navigation) |
| 6 | Each badge shows: category name, dollar amount, percentage |
| 7 | Clicking a badge navigates to `/cashflow/transactions?tab=expenses&categoryName=<name>&dateFrom=<from>&dateTo=<to>` |
| 8 | Bank account filter is respected — breakdown matches the filtered total |
| 9 | Widget renders `null` when there are no expenses for the selected year |
| 10 | Colors are dark-mode safe |
