# Cashflow Analytics Dashboard — Low Level Design

## Overview

A new `/cashflow/analytics` page that surfaces income vs expense trends, category breakdowns, and key financial KPIs. Uses shadcn/ui chart primitives (Recharts under the hood) for visualisation. All data aggregation is server-side via a new REST endpoint; the page uses the established Server Component + Client Wrapper pattern.

---

## UX Design

### Layout

```
/cashflow/analytics
┌────────────────────────────────────────────────────────────────┐
│  Cashflow Analytics                                            │
│  [Fiscal Year 2024/25 ▼]  [All Accounts ▼]                    │
├────────────┬────────────┬────────────┬────────────────────────┤
│ Income     │ Expenses   │ Net Flow   │ Savings Rate           │
│ $54,200    │ $38,100    │ +$16,100   │  29.7%                 │
│ ↑ vs avg   │ ↓ vs avg   │            │                        │
├────────────┴────────────┴────────────┴────────────────────────┤
│  Income vs Expenses — Monthly Trend                            │
│  [Grouped bar chart: green=income, red=expenses, 12 bars]     │
│                                                                │
├─────────────────────────────┬──────────────────────────────────┤
│  Expenses by Category        │  Net Cashflow per Month         │
│  [Horizontal bar chart]      │  [Bar chart +/- color coded]    │
│  Food       $2,100  ████  22%│  Jan  ████  +$1.2k             │
│  Transport  $1,500  ███   16%│  Feb  ██    +$800              │
│  Housing    $4,200  ████  44%│  Mar  (neg) -$400              │
│  [+ 8 more]                  │                                 │
├─────────────────────────────┴──────────────────────────────────┤
│  Income by Source                                              │
│  [Horizontal bar or donut chart]                               │
│  Salary       $48,000  ████████  88.5%                        │
│  Freelance    $4,200   ███        7.7%                        │
│  Other        $2,000   ██         3.7%                        │
└────────────────────────────────────────────────────────────────┘
```

### Interaction Patterns

| Action | Behaviour |
|--------|-----------|
| Change year picker | Refetch all charts and KPIs; update URL `?calendarYearId=` |
| Change bank filter | Refetch all charts and KPIs; update URL `?bankAccountId=` |
| Hover on bar | Tooltip with formatted amount (currency), month label |
| Click month bar (trend chart) | Navigate to `/cashflow/expense?calendarYearId=X&month=Y` |
| Click category row/bar | Navigate to `/cashflow/transactions?category=X&calendarYearId=Y` |
| Click income source row | Navigate to `/cashflow/income?calendarYearId=X&source=Y` |
| Page load / filter change | All sections show skeleton until data resolves |

### Chart Colour Palette

| Series | Colour token | Rationale |
|--------|-------------|-----------|
| Income | `hsl(var(--chart-2))` — green | Money in = positive |
| Expenses | `hsl(var(--chart-1))` — red/rose | Money out = caution |
| Net positive | `hsl(var(--chart-2))` — green | Surplus |
| Net negative | `hsl(var(--chart-1))` — red | Deficit |
| Category bars | Sequential from `--chart-3` to `--chart-5` | Differentiation |
| Source bars/slices | Sequential from `--chart-4` to `--chart-5` | Differentiation |

All colours must include `dark:` variants via the shadcn chart CSS variable system.

---

## Data Layer

### New Service Functions

**`src/server/services/income.service.ts` additions:**

```typescript
/**
 * Get income breakdown by source for a full calendar year.
 * Queries CREDIT CONFIRMED Transactions; groups by category (= income source name).
 */
export const getIncomeSourceBreakdownForYear = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
): Promise<Array<SourceBreakdown>> => {
  // Resolve calendarYear date range
  // Query Transaction(type=CREDIT, status=CONFIRMED, date in range, optional bankAccountId)
  // Group by category; compute amount + percentage
  // Return sorted by amount DESC
};

/**
 * Get monthly income summary with optional bankAccountId filter.
 * Extends existing getMonthlyIncomeSummary to support bank account filtering.
 */
export const getMonthlyIncomeSummaryFiltered = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
): Promise<Array<MonthlyIncomeSummary>> => {
  // Same logic as getMonthlyIncomeSummary but adds bankAccountId filter
  // Manual entries (bankAccountId=null) always included
};
```

**`src/server/services/expense.service.ts` additions:**

```typescript
/**
 * Get expense breakdown by category for a full calendar year.
 * Groups DEBIT CONFIRMED Transactions (excl. TRANSFER) by category name.
 */
export const getExpenseCategoryBreakdownForYear = async (
  calendarYearId: string,
  userId: string,
  bankAccountId?: string,
): Promise<Array<CategoryBreakdown>> => {
  // Resolve calendarYear date range
  // Query Transaction(type=DEBIT, status=CONFIRMED, category != TRANSFER, date in range, optional bankAccountId)
  // Group by category name; resolve to ExpenseCategory ID via name lookup
  // Compute amount + percentage
  // Return sorted by amount DESC
};
```

### New API Route

**`src/app/api/cashflow/analytics/route.ts`**

```typescript
GET /api/cashflow/analytics?calendarYearId=<id>&bankAccountId=<optional>

Response: CashflowAnalyticsData
```

**Response type** (`src/server/models/cashflow-analytics.ts`):

```typescript
export type MonthlyTrendPoint = {
  month: number;       // 1–12
  year: number;
  label: string;       // e.g. "Jul '24"
  income: number;
  expenses: number;
  net: number;         // income - expenses
};

export type CashflowKPIs = {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRate: number;       // (net / income) * 100; 0 if income = 0
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
};

export type CashflowAnalyticsData = {
  kpis: CashflowKPIs;
  monthlyTrend: MonthlyTrendPoint[];    // sorted by year asc, month asc
  expenseCategories: CategoryBreakdown[];  // sorted by amount desc
  incomeSources: SourceBreakdown[];        // sorted by amount desc
};
```

**Handler logic:**

1. Authenticate via `auth()` — 401 if no session
2. Validate `calendarYearId` query param — 400 if missing
3. Call in parallel (Promise.all):
   - `getMonthlyIncomeSummaryFiltered(calendarYearId, userId, bankAccountId)`
   - `getMonthlyExpenseSummaries(calendarYearId, userId, bankAccountId)`
   - `getTotalIncome(calendarYearId, userId, bankAccountId)`
   - `getTotalExpenses(calendarYearId, userId, bankAccountId)`
   - `getExpenseCategoryBreakdownForYear(calendarYearId, userId, bankAccountId)`
   - `getIncomeSourceBreakdownForYear(calendarYearId, userId, bankAccountId)`
4. Assemble `monthlyTrend` by merging income and expense arrays by month
5. Compute `CashflowKPIs`
6. Return JSON

---

## Route & Component Structure

```
src/app/(authorized)/cashflow/analytics/
  page.tsx                          ← Server Component: load calendar years, bank accounts, pass to client
  _components/
    CashflowAnalyticsClient.tsx     ← Client: period/bank filter state, fetches analytics data
    KPISummaryCards.tsx             ← 4 KPI cards with color-coded values
    IncomeExpenseTrendChart.tsx      ← Grouped bar chart (shadcn BarChart)
    NetCashflowChart.tsx            ← Single-series bar chart, positive=green/negative=red
    ExpenseCategoryChart.tsx        ← Horizontal bar chart for top expense categories
    IncomeSourceChart.tsx           ← Horizontal bar chart (or donut) for income sources
    ChartSkeleton.tsx               ← Shared skeleton placeholder for chart areas
```

### `page.tsx` (Server Component)

```typescript
// Fetches:
// - calendarYears (FISCAL + ANNUAL types) via getCalendarYearsHandler
// - userFiscalYearType via getUserFiscalYearType
// - defaultCalendarYear via getDefaultCalendarYear
// - bankAccounts via getBankAccountsForUser (returns FinancialAccount[])
// Passes props to CashflowAnalyticsClient (no data fetching in client)
// Auth guard: redirect to /auth/signin if no session
```

**Page metadata:**
```typescript
export const metadata: Metadata = {
  title: 'Cashflow Analytics | My Financials',
  description: 'Visualise income vs expenses, category breakdowns, and savings trends',
};
```

### `CashflowAnalyticsClient.tsx` (Client Component)

**State:**
```typescript
const [selectedYearId, setSelectedYearId] = useState<string | null>(initialCalendarYearId)
const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null)
const [analyticsData, setAnalyticsData] = useState<CashflowAnalyticsData | null>(null)
const [loading, setLoading] = useState(false)
```

**URL sync:** `useEffect` syncs `calendarYearId` and `bankAccountId` to `?calendarYearId=X&bankAccountId=Y` on change (using `useRouter` + `useSearchParams`).

**Data fetch:** `useEffect` on `[selectedYearId, selectedBankAccountId]` → fetch `/api/cashflow/analytics?calendarYearId=X&bankAccountId=Y` → set `analyticsData`.

**Layout:**
```
Filters row (year picker + bank picker)
KPISummaryCards (or skeleton)
IncomeExpenseTrendChart (full width, or skeleton)
2-column row: ExpenseCategoryChart | NetCashflowChart
IncomeSourceChart (full width or right-aligned)
```

### `KPISummaryCards.tsx`

Props: `kpis: CashflowKPIs | null; loading: boolean`

4 cards in a responsive grid (`grid-cols-2 md:grid-cols-4`):

| Card | Value | Colour | Icon |
|------|-------|--------|------|
| Total Income | `$XX,XXX` | `text-green-600 dark:text-green-400` | `TrendingUp` |
| Total Expenses | `$XX,XXX` | `text-red-600 dark:text-red-400` | `Receipt` |
| Net Cashflow | `+$XX,XXX` or `-$X,XXX` | green if positive, red if negative | `ArrowUpDown` |
| Savings Rate | `XX.X%` | **always neutral** (avoid financial shame) — `text-foreground` | `PiggyBank` |

**Savings Rate card extras:**
- Show the 20% benchmark as a thin progress bar under the percentage: `━━━━━━━━━━░░░░░ 29.3% (target: 20%)`
- An `InfoTooltip` (existing component) explaining the formula: `(Income − Expenses) ÷ Income × 100`
- When income is zero: display `"N/A"` — never divide by zero
- When savings rate is negative: show the negative value in `text-red-600` with a note "Expenses exceeded income"

Loading: render `Skeleton` placeholders at same height.

### `IncomeExpenseTrendChart.tsx`

**Chart:** shadcn `BarChart` (grouped/side-by-side bars) with a net cashflow overlay line

**X axis:** Month labels (`"Jul '24"`, `"Aug '24"` …) — derive from `MonthlyTrendPoint.label`

**Y axis:** Currency formatted amounts (`$0`, `$5k`, `$10k`)

**Two bar series:** Income (green), Expenses (red/rose)

**Overlay line series:** Net cashflow (blue, dashed) — rendered as a Recharts `Line` composited on the same `ComposedChart`. This gives users the trend direction at a glance without cluttering the bar comparison.

**Reference line:** Horizontal line at `y=0` so negative net cashflow months are immediately visible

**Tooltip:** Shows on hover:
- `Income: $X,XXX`
- `Expenses: $X,XXX`
- `Net: +$X,XXX` (colored green/red)

**Click handler:** On bar click, navigate to:
- Income bar → `/cashflow/income?calendarYearId=X&month=M&year=Y`
- Expense bar → `/cashflow/expense?calendarYearId=X&month=M&year=Y`

**Empty state:** "No data for this period" message when `monthlyTrend` has all zeros

### `NetCashflowChart.tsx`

**Chart:** shadcn `BarChart` (single series)

**X axis:** Month labels

**Y axis:** Net values (can be negative)

**Color logic:** Each bar's fill is green if `net > 0`, red if `net < 0` — use `Cell` from Recharts to apply per-bar colors

**Reference line:** horizontal line at `y=0` (Recharts `ReferenceLine`)

**Tooltip:** Shows "Net: +$X,XXX" or "Net: -$X,XXX"

### `ExpenseCategoryChart.tsx`

Research confirms: **horizontal sorted bar chart outperforms donut/pie for category comparison** (users judge bar length more accurately than angle/area — Cleveland & McGill 1984; Wilke Ch. 10). Use a two-level progressive disclosure pattern:

**Level 1 — Donut summary widget** (compact): Shows top 5 categories as a donut with percentage labels. Acts as a visual "entry point" and space-efficient overview. Max 5–6 slices; group the rest into "Other".

**Level 2 — Horizontal bar list** (below the donut or toggled): Full ranked list of categories.

**Chart:** Horizontal `BarChart` (shadcn) — categories on Y axis, amounts on X axis

**Show top 8 categories** by amount; rest collapsed under "Other (N more)" with an expand button

**Each row:** Category name | bar proportional to amount | `$X,XXX (XX%)`

**Click handler:** Navigate to `/cashflow/transactions?category=<categoryName>&calendarYearId=X` (aligns with drill-down spec)

**Empty state:** "No expenses recorded" message

### `IncomeSourceChart.tsx`

**Chart:** Horizontal `BarChart` (same pattern as `ExpenseCategoryChart`)

**Show all income sources** (typically <6)

**Each row:** Source name | bar | `$X,XXX (XX%)`

**Click handler:** Navigate to `/cashflow/income?calendarYearId=X&source=<sourceName>`

**Empty state:** "No income recorded" message

---

## Navigation Changes

### Sidebar

Add "Analytics" entry under the Cashflow nav group:

```
Cashflow
  ├─ Income
  ├─ Expenses  
  ├─ Transactions
  ├─ Analytics   ← NEW (BarChart2 icon from lucide-react)
  ├─ Donations
  └─ Bank Interest
```

### Home Dashboard Enhancement

Replace the static "View Income" / "View Expenses" quick-action cards with live KPI cards:

- Fetch `getTotalIncome` and `getTotalExpenses` for the **current fiscal year** in the Server Component
- Show actual dollar amounts on the home dashboard cards
- Add a CTA link to `/cashflow/analytics` from the home page

---

## Acceptance Criteria

### AC1 — Page loads with correct period
- Navigating to `/cashflow/analytics` shows the user's default fiscal year selected
- All 4 KPI cards, trend chart, category chart, net flow chart, and source chart render with data
- URL reflects `?calendarYearId=<id>`

### AC2 — Period and bank filter
- Changing the year picker refetches all charts and KPIs; URL updates
- Changing the bank account filter refetches all charts; manual-entry income/expenses remain visible regardless of bank filter
- "All Accounts" option shows combined totals

### AC3 — Chart interactions
- Hovering a bar shows a tooltip with formatted currency amount
- Clicking a month on the trend chart navigates to the expense/income page filtered to that month
- Clicking a category on the expense chart navigates to transactions filtered by that category

### AC4 — Empty / loading states
- While data is loading, all chart areas show skeletons
- If a year has no income OR no expenses, the relevant section shows an appropriate empty state message (not a broken chart)
- A year with only income and no expenses: expense chart shows empty state; KPIs still show income total

### AC5 — Savings rate edge cases
- When income is zero: savings rate shows "N/A" (not divide-by-zero)
- When expenses exceed income: savings rate shows negative % in red

### AC6 — Dark mode
- All chart colours, card backgrounds, axis labels, and tooltips are visible in both light and dark mode
- shadcn chart CSS variables (`--chart-1` through `--chart-5`) provide the colour tokens

### AC7 — Responsive layout
- On mobile (< 768px): KPI cards stack 2×2; trend chart scrolls horizontally if needed; category/source charts are full width stacked
- On desktop: 4-column KPI row; full-width trend chart; 2-column bottom row

### AC8 — Home dashboard KPIs
- Home page shows real dollar amounts for current fiscal year income and expenses (not placeholder cards)
- Link to `/cashflow/analytics` is present on the home page

---

## Implementation Notes

### shadcn chart setup
Run once before implementing chart components:
```bash
pnpm dlx shadcn@latest add chart
```
This creates `src/components/ui/chart.tsx` and adds required CSS variables to `globals.css`.

### Recharts version compatibility
Recharts 3.x (already installed) introduced breaking changes in chart sizing — use `ResponsiveContainer` from Recharts or the shadcn `ChartContainer` wrapper (which handles responsive sizing correctly).

### API route pattern
Follow the existing `/api/income/monthly-summary/route.ts` pattern:
- Use `auth()` for session
- Return `NextResponse.json(data)` on success
- Return `NextResponse.json({ error: '...' }, { status: 400/401 })` on error

### Month label helper
```typescript
// Shared utility: src/utils/month-label.ts
export const formatMonthLabel = (month: number, year: number): string => {
  return new Date(year, month - 1, 1).toLocaleString('en-AU', {
    month: 'short',
    year: '2-digit',  // "Jul '24"
  });
};
```

### Bank account options
For the bank filter dropdown, reuse the `bankAccountRouter.list` tRPC procedure or fetch from existing bank account API. The "All Accounts" option maps to `bankAccountId = undefined` in the API call.

### Parallel data fetching in API handler
Use `Promise.all` for the 6 concurrent service calls to keep API latency minimal (< 500ms for typical datasets).
