# Dashboard Feature LLD (As-Built)

> This is as-built documentation. The implementation diverged from the original spec: no `/api/dashboard/summary` route was built; all data is fetched directly in the Server Component page.

## Two-Wave Data Fetch Pattern

Data is loaded in two parallel Promise.all waves:

```typescript
// Wave 1: non-year-scoped
const [netWorth, calendarYears] = await Promise.all([
  getNetWorthTrend(userId),
  getCalendarYears(['FISCAL', 'ANNUAL']),
]);

// Anchor year selection
const selectedYear =
  calendarYears.find((y) => y.type === 'FISCAL') ??
  calendarYears.find((y) => y.type === 'ANNUAL') ??
  calendarYears[0] ?? null;

// Wave 2: year-scoped
const [totalIncome, totalExpenses, monthlyTrend, topExpenses, recentTransactions] = selectedYear
  ? await Promise.all([
      getTotalIncome(selectedYear.id, userId),
      getTotalExpenses(selectedYear.id, userId),
      getMonthlyTrendForDateRange(userId, selectedYear.from, selectedYear.to),
      getTopExpenseCategories(userId, selectedYear.from, selectedYear.to, 5),
      prisma.transaction.findMany({ ... }),
    ])
  : [null, null, [], [], []];
```

## Widget Component Interfaces

```typescript
// NetWorthWidget
interface NetWorthWidgetProps {
  netWorth: {
    latestTotal: number
    latestCashTotal: number
    latestStockTotal: number
    latestCashDate: string | null
    latestStockDate: string | null
    sparklinePoints: Array<{ date: string; value: number }>
  }
}

// AssetBalanceCards
interface AssetBalanceCardsProps {
  cashTotal: number
  stockTotal: number
}

// CashflowPulseCard
interface CashflowPulseCardProps {
  cashflowYTD: {
    calendarYearId: string
    calendarYearDescription: string
    totalIncome: number
    totalExpenses: number
    netCashflow: number
    savingsRate: number // 0–100
  } | null
}

// RecentTransactionsWidget
interface RecentTransactionsWidgetProps {
  transactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: 'DEBIT' | 'CREDIT'
    category: string
    bankAccountName: string | null
  }>
}

// MonthlyTrendWidget
interface MonthlyTrendWidgetProps {
  data: Array<{ month: string; income: number; expenses: number }>
}

// TopExpensesWidget
interface TopExpensesWidgetProps {
  data: Array<{ category: string; total: number }>
}

// AIUsageDashboardCard
interface AIUsageDashboardCardProps {
  importType: 'EXPENSE' | 'BANK_ASSET' | 'STOCK'
  userId: string
}
```

## DashboardSummaryResponse Interface

```typescript
interface DashboardSummaryResponse {
  netWorth: {
    latestTotal: number
    latestCashTotal: number
    latestStockTotal: number
    latestCashDate: string | null
    latestStockDate: string | null
    sparklinePoints: Array<{ date: string; value: number }>
  }
  cashflowYTD: {
    calendarYearId: string
    calendarYearDescription: string
    totalIncome: number
    totalExpenses: number
    netCashflow: number
    savingsRate: number  // 0–100
  } | null
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
type MonthlyTrendPoint = { month: string; income: number; expenses: number }
type TopExpenseCategory = { category: string; total: number }
```

## TDD Test Cases

| Test                                         | Type    | Verifies                                      |
|----------------------------------------------|---------|-----------------------------------------------|
| Renders all widgets for valid user           | Unit    | All widgets render with valid data             |
| Handles empty net worth snapshots            | Unit    | NetWorthWidget renders empty state             |
| Handles no calendar year                     | Unit    | CashflowPulseCard renders null/empty           |
| RecentTransactionsWidget excludes transfers  | Unit    | Only non-transfer, confirmed transactions      |
| AIUsageDashboardCard streams independently   | Integration | Each card loads async, does not block others |

## As-Built File Inventory

| File                                                        | Status | Description                                   |
|-------------------------------------------------------------|--------|-----------------------------------------------|
| src/app/(authorized)/home/page.tsx                          | ✅ BUILT | Main dashboard page (Server Component)         |
| src/app/(authorized)/home/_components/NetWorthWidget.tsx    | ✅ BUILT | Net worth hero + sparkline                    |
| src/app/(authorized)/home/_components/AssetBalanceCards.tsx | ✅ BUILT | Bank + stock KPI cards                        |
| src/app/(authorized)/home/_components/CashflowPulseCard.tsx | ✅ BUILT | Fiscal year income/expense/net/savings rate    |
| src/app/(authorized)/home/_components/RecentTransactionsWidget.tsx | ✅ BUILT | Last 5 confirmed transactions         |
| src/app/(authorized)/home/_components/MonthlyTrendWidget.tsx | ✅ BUILT | Monthly income vs expense bar chart           |
| src/app/(authorized)/home/_components/TopExpensesWidget.tsx | ✅ BUILT | Top 5 expense categories                      |
| src/app/(authorized)/home/_components/AIUsageDashboardCard.tsx | ✅ BUILT | Per-import-type AI spend card (async RSC)     |
| src/app/(authorized)/home/_components/DashboardWidgetSkeleton.tsx | ✅ BUILT | Shared skeleton for Suspense fallback |
| src/server/models/dashboard.ts                              | ✅ BUILT | DashboardSummaryResponse + types               |
| src/server/services/dashboard.service.ts                    | ✅ BUILT | getMonthlyTrendForDateRange, getTopExpenseCategories |
| src/server/services/asset-dashboard.service.ts              | ✅ BUILT | getNetWorthTrend                              |
