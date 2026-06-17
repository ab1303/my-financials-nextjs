# Home Dashboard Widgets — Low-Level Design (LLD)

## Phase Map
| Phase | Name                | Files                                         | Depends On |
|-------|---------------------|-----------------------------------------------|------------|
| 1     | Dashboard API Route | route.ts, dashboard.ts model                  | —          |
| 2     | Widget Components   | 5 component files                             | Phase 1    |
| 3     | Page Integration    | home/page.tsx                                 | Phase 2    |

---

## Implementation Note (Drift from Original Spec)

The actual implementation diverges from this LLD in two ways:

1. **No API route**: Data is fetched directly in `home/page.tsx` as a Server Component using direct service imports (not via `/api/dashboard/summary`). The API route was never created.
2. **No per-widget Suspense**: All data is fetched in two parallel `Promise.all` waves in the page component. Individual `<Suspense>` wrappers per widget were not used.
3. **Extra widgets**: `MonthlyTrendWidget` and `TopExpensesWidget` were added beyond the original spec scope, using `getMonthlyTrendForDateRange` and `getTopExpenseCategories` from `dashboard.service.ts`.

The file inventory below is updated to reflect the as-built state.

---

## Phase 1 — Dashboard API Route

**DashboardSummaryResponse interface:**
```typescript
interface DashboardSummaryResponse {
  netWorth: {
    latestTotal: number
    latestCashTotal: number
    latestStockTotal: number
    latestCashDate: string | null
    latestStockDate: string | null
    sparklinePoints: Array<{ date: string; value: number }>  // last 6 data points
  }
  cashflowYTD: {
    calendarYearId: string
    calendarYearDescription: string
    totalIncome: number
    totalExpenses: number
    netCashflow: number
    savingsRate: number  // percentage (0–100)
  } | null  // null if no calendar year exists
  recentTransactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: 'DEBIT' | 'CREDIT'
    category: string
    bankAccountName: string | null
  }>
}
```
- Auth pattern: `const session = await auth()`
- 401 if unauthenticated, 500 on service error
- Fetch net worth, calendar year, and MTD totals in parallel via `Promise.all`
- Sparkline: last 6 `dataPoints` from `getNetWorthTrend`, mapped to `{ date, value: netWorthTotal }`

---

## Phase 2 — Widget Components

**NetWorthWidget.tsx**
- Props: `{ netWorth: DashboardSummaryResponse['netWorth'] }`
- Renders latest net worth as large number, sparkline (recharts AreaChart, last 6 points)
- Shows "No data" if `latestTotal = 0` or no data points

**AssetBalanceCards.tsx**
- Props: `{ latestCashTotal: number, latestStockTotal: number, latestCashDate: string | null, latestStockDate: string | null }`
- Renders two KPI cards: Bank Balance, Stock Portfolio
- Shows 0 or "No data" if values missing

**CashflowPulseCard.tsx**
- Props: `{ cashflowYTD: DashboardSummaryResponse['cashflowYTD'] }`
- Renders income, expenses, net, savings rate progress bar
- Shows "No data" if `cashflowYTD` is null

**RecentTransactionsWidget.tsx**
- Props: `{ transactions: DashboardSummaryResponse['recentTransactions'] }`
- Renders last 5 confirmed transactions: date, description (max 40 chars), category badge, amount (color by type)
- Shows "No transactions yet" if array empty

**DashboardWidgetSkeleton.tsx**
- Shared skeleton for Suspense fallback

- All widgets are Server Components, no client code needed for MVP
- Use recharts AreaChart in NetWorthWidget: `<ResponsiveContainer width="100%" height={60}><AreaChart ... /></ResponsiveContainer>`
- No axes, no tooltip, just the line

---

## Phase 3 — Page Integration
- Insert Suspense-wrapped widget sections above existing Quick Action Cards grid in `home/page.tsx`
- Each widget: `<Suspense fallback={<DashboardWidgetSkeleton />}>...</Suspense>`

---

## TDD Test Cases
| Test                                              | Type        | Verifies                        |
|---------------------------------------------------|-------------|---------------------------------|
| API returns 401 when unauthenticated              | Integration | Auth guard                      |
| API returns netWorth.latestTotal = 0 when no snapshots | Integration | Empty state handling        |
| API returns sparklinePoints with max 6 entries    | Unit        | Sparkline slicing               |
| API returns cashflowYTD = null when no calendar year | Integration | Null guard                  |
| API returns recentTransactions filtered to CONFIRMED status | Integration | Transaction filter    |
| NetWorthWidget renders "No data" when latestTotal = 0 | Component   | Empty state UI              |
| RecentTransactionsWidget renders "No transactions yet" when array is empty | Component | Empty state UI |
| CashflowPulseCard shows savings rate as percentage progress bar | Component | Savings rate display |

---

## File Inventory (As-Built)
| File                                                        | Status   | Description                                 |
|-------------------------------------------------------------|----------|---------------------------------------------|
| src/app/api/dashboard/summary/route.ts                      | ❌ NOT BUILT | API route not created — data fetched in page.tsx directly |
| src/server/models/dashboard.ts                              | ✅ BUILT | DashboardSummaryResponse type               |
| src/app/(authorized)/home/_components/NetWorthWidget.tsx    | ✅ BUILT | Net worth hero + sparkline                  |
| src/app/(authorized)/home/_components/AssetBalanceCards.tsx | ✅ BUILT | Bank + stock KPI cards                      |
| src/app/(authorized)/home/_components/CashflowPulseCard.tsx | ✅ BUILT | MTD income/expense/net + savings rate       |
| src/app/(authorized)/home/_components/RecentTransactionsWidget.tsx | ✅ BUILT | Last 5 confirmed transactions         |
| src/app/(authorized)/home/_components/DashboardWidgetSkeleton.tsx | ✅ BUILT | Shared skeleton placeholder           |
| src/app/(authorized)/home/_components/MonthlyTrendWidget.tsx | ✅ BUILT (extra) | Monthly income vs expense trend chart (beyond original scope) |
| src/app/(authorized)/home/_components/TopExpensesWidget.tsx | ✅ BUILT (extra) | Top expense categories chart (beyond original scope) |
| src/app/(authorized)/home/page.tsx                          | ✅ BUILT | All data fetched in page.tsx via Promise.all; no Suspense per widget |
