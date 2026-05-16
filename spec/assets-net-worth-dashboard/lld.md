# LLD: Assets Net Worth Dashboard

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| **Phase 1** | `asset-dashboard.service.ts`, `asset-dashboard.controller.ts`, `asset-dashboard.schema.ts`, `router/asset-dashboard.ts`, `router/index.ts`, `types/asset-dashboard.types.ts` | Backend: net worth trend API |
| **Phase 2** | `assets/page.tsx`, `assets/NetWorthDashboardClient.tsx`, `assets/_components/NetWorthChart.tsx`, `assets/_components/AssetSummaryCards.tsx` | Frontend: Assets Dashboard page with trend chart |
| **Phase 3** | `layouts/SideNav.tsx` | Navigation: add "Overview" item to Asset(s) group |

---

## Phase 1 — Backend: Net Worth Trend API

### 1.1 Install Recharts

```bash
pnpm add recharts
pnpm add -D @types/recharts
```

> Note: `recharts` has built-in TypeScript types from v2.x — `@types/recharts` may not be needed. Verify after install.

### 1.2 Types: `src/types/asset-dashboard.types.ts`

```typescript
export interface NetWorthDataPoint {
  /** ISO date string (YYYY-MM-DD) from the BankBalanceSnapshot anchor date */
  date: string;
  /** Sum of all BankBalanceRecord.balance for the cash snapshot — AUD */
  cashTotal: number;
  /** Sum of (quantity * currentPrice) for AUD-currency StockHoldings at nearest PortfolioSnapshot */
  stockTotal: number;
  /** cashTotal + stockTotal */
  netWorthTotal: number;
  /** Source BankBalanceSnapshot.id */
  cashSnapshotId: string;
  /** Nearest PortfolioSnapshot.id used for stockTotal; null if no stock snapshot exists on or before this date */
  stockSnapshotId: string | null;
  /** True if stockSnapshotId date differs from this date (stale stock data was used) */
  isStockStale: boolean;
}

export interface NetWorthTrendFilters {
  fromDate?: Date;
  toDate?: Date;
  calendarYearId?: string;
}

export interface NetWorthTrendResponse {
  dataPoints: NetWorthDataPoint[];
  /** Latest cash snapshot total (for summary card) */
  latestCashTotal: number;
  /** Latest stock snapshot total AUD (for summary card) */
  latestStockTotal: number;
  /** latestCashTotal + latestStockTotal */
  latestNetWorth: number;
  /** ISO date of latest cash snapshot */
  latestCashDate: string | null;
  /** ISO date of latest stock snapshot */
  latestStockDate: string | null;
}
```

### 1.3 Zod Schema: `src/server/schema/asset-dashboard.schema.ts`

```typescript
import { z } from 'zod';

export const getNetWorthTrendSchema = z.object({
  /** Optional: restrict to snapshots within a calendar year's date range */
  calendarYearId: z.string().optional(),
  /** Optional: override date range directly (ignored if calendarYearId is provided) */
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
});

export type GetNetWorthTrendInput = z.infer<typeof getNetWorthTrendSchema>;
```

### 1.4 Service: `src/server/services/asset-dashboard.service.ts`

```typescript
import { prisma } from '../utils/prisma';
import type { NetWorthDataPoint, NetWorthTrendFilters, NetWorthTrendResponse } from '@/types/asset-dashboard.types';

/**
 * Builds a unified net worth time series from BankBalanceSnapshot + PortfolioSnapshot.
 *
 * Aggregation strategy — Last Known Value:
 *   Each BankBalanceSnapshot date is an anchor.
 *   stockTotal = sum(qty * currentPrice) for AUD holdings from the most recent
 *   PortfolioSnapshot on or before that anchor date.
 *   USD holdings are excluded from the total.
 */
export const getNetWorthTrend = async (
  userId: string,
  filters?: NetWorthTrendFilters,
): Promise<NetWorthTrendResponse> => { ... }

/**
 * Derives fromDate / toDate from a CalendarYear record.
 * Uses 1st of fromMonth and last day of toMonth (no day precision in schema).
 */
export const resolveDateRangeFromCalendarYear = async (
  calendarYearId: string,
): Promise<{ fromDate: Date; toDate: Date }> => { ... }
```

**Implementation notes:**

1. Fetch `BankBalanceSnapshot[]` filtered by `userId` + optional date range, ordered by `snapshotDate ASC`, including `balanceRecords`
2. Fetch ALL `PortfolioSnapshot[]` for the user (no date filter — needed for last-known-value lookback), ordered by `snapshotDate ASC`, including `holdings WHERE currency = AUD`
3. For each cash snapshot (anchor):
   - `cashTotal = sum(record.balance)` — convert `Decimal` to `number`
   - Find latest portfolio snapshot where `snapshotDate <= anchor.snapshotDate`
   - `stockTotal = sum(holding.quantity * holding.currentPrice)` for that portfolio snapshot
   - `isStockStale = portfolioSnapshot.snapshotDate.toDateString() !== anchor.snapshotDate.toDateString()`
4. Compute `latestCashTotal`, `latestStockTotal`, `latestNetWorth` from the last data point
5. Return `NetWorthTrendResponse`

### 1.5 Controller: `src/server/controllers/asset-dashboard.controller.ts`

```typescript
import type { GetNetWorthTrendInput } from '@/server/schema/asset-dashboard.schema';
import { getNetWorthTrend, resolveDateRangeFromCalendarYear } from '@/server/services/asset-dashboard.service';
import { handleCaughtError } from '@/server/utils/error';

export const getNetWorthTrendHandler = async ({
  input,
  userId,
}: {
  input: GetNetWorthTrendInput;
  userId: string;
}) => {
  try {
    let filters = {};
    if (input.calendarYearId) {
      const { fromDate, toDate } = await resolveDateRangeFromCalendarYear(input.calendarYearId);
      filters = { fromDate, toDate };
    } else if (input.fromDate || input.toDate) {
      filters = { fromDate: input.fromDate, toDate: input.toDate };
    }
    return await getNetWorthTrend(userId, filters);
  } catch (error) {
    throw handleCaughtError(error);
  }
};
```

### 1.6 Router: `src/server/trpc/router/asset-dashboard.ts`

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { getNetWorthTrendHandler } from '@/server/controllers/asset-dashboard.controller';
import { getNetWorthTrendSchema } from '@/server/schema/asset-dashboard.schema';

export const assetDashboardRouter = router({
  getNetWorthTrend: protectedProcedure
    .input(getNetWorthTrendSchema)
    .query(({ input, ctx: { session } }) =>
      getNetWorthTrendHandler({ input, userId: session.user.id }),
    ),
});
```

### 1.7 Router Registration: `src/server/trpc/router/index.ts`

Add to existing router map:
```typescript
import { assetDashboardRouter } from './asset-dashboard';

// Inside createTRPCRouter({...}):
assetDashboard: assetDashboardRouter,
```

### Phase 1 Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1.1 | `getNetWorthTrend` returns empty `dataPoints: []` and zeros when user has no snapshots | Unit | Edge case — new user |
| 1.2 | `getNetWorthTrend` returns correct `cashTotal` when user has 3 bank accounts in one snapshot | Unit | `SUM(balance)` aggregation |
| 1.3 | `getNetWorthTrend` returns `stockTotal = 0` and `stockSnapshotId = null` when no portfolio snapshots exist | Unit | No stock data case |
| 1.4 | `getNetWorthTrend` uses last-known-value: cash snapshot on 15 Mar uses portfolio snapshot from 1 Mar (no 15 Mar portfolio exists) | Unit | Last-known-value aggregation |
| 1.5 | `getNetWorthTrend` sets `isStockStale = true` when portfolio snapshot date differs from cash anchor date | Unit | Staleness flag |
| 1.6 | `getNetWorthTrend` excludes USD-currency holdings from `stockTotal` | Unit | Currency filtering |
| 1.7 | `getNetWorthTrend` with `calendarYearId` only returns data points within the calendar year's date range | Integration | Calendar lens filtering |
| 1.8 | `getNetWorthTrend` returns data points sorted ascending by date | Unit | Sort order |
| 1.9 | `resolveDateRangeFromCalendarYear` for FISCAL 2024-2025 returns `fromDate = 2024-07-01` and `toDate = 2024-06-30T23:59:59` of 2025 | Unit | Date boundary computation |
| 1.10 | `getNetWorthTrendHandler` throws `TRPCError NOT_FOUND` if `calendarYearId` does not exist | Integration | Error handling |

---

## Phase 2 — Frontend: Assets Dashboard Page

### 2.1 Server Component: `src/app/(authorized)/assets/page.tsx`

```typescript
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { auth } from '@/server/auth';
import { getCalendarYearsHandler } from '@/server/controllers/calendar-year.controller';
import NetWorthDashboardClient from './NetWorthDashboardClient';

export const metadata: Metadata = {
  title: 'Assets Overview | My Financials',
  description: 'Net worth trend across cash and stock assets',
};

export default async function AssetsOverviewPage() {
  const session = await auth();
  if (!session?.user?.id) { /* auth guard — same pattern as bank/page.tsx */ }

  const calendarYears = await getCalendarYearsHandler();

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Assets Overview
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Net worth trend across cash and stock assets
        </p>
      </div>
      <Suspense fallback={<p className='text-muted-foreground'>Loading...</p>}>
        <NetWorthDashboardClient calendarYears={calendarYears} />
      </Suspense>
    </main>
  );
}
```

### 2.2 Client Component Props Interface: `NetWorthDashboardClient`

```typescript
import type { CalendarYear } from '@prisma/client';

interface NetWorthDashboardClientProps {
  calendarYears: CalendarYear[];
}

// Internal state
interface LensState {
  type: 'ALL' | CalendarEnumType;   // 'ALL' | 'FISCAL' | 'ANNUAL' | 'ZAKAT'
  calendarYearId: string | null;    // null when type = 'ALL'
}

// Chart line visibility state
interface LineVisibility {
  total: boolean;
  cash: boolean;
  stocks: boolean;
}
```

**Client Component responsibilities:**
- Maintains `LensState` + `LineVisibility` in `useState`
- Calls `trpc.assetDashboard.getNetWorthTrend` with derived `calendarYearId`
- Passes `data` to `<NetWorthChart />` and `<AssetSummaryCards />`
- Renders calendar type toggle (ALL / FISCAL / ANNUAL / ZAKAT) + year dropdown when type ≠ ALL
- Links to `/assets/bank` and `/assets/stocks` for detail drill-down

### 2.3 Chart Component: `src/app/(authorized)/assets/_components/NetWorthChart.tsx`

```typescript
'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { NetWorthDataPoint } from '@/types/asset-dashboard.types';

interface NetWorthChartProps {
  data: NetWorthDataPoint[];
  visibility: { total: boolean; cash: boolean; stocks: boolean };
  onToggleLine: (line: 'total' | 'cash' | 'stocks') => void;
}

// Line colours:
// Total Assets: #7c3aed  (purple-600)
// Cash:         #2563eb  (blue-600)
// Stocks:       #16a34a  (green-600)

// X-axis: date formatted as 'DD MMM YY'
// Y-axis: AUD formatted as '$XX,XXX'
// Tooltip: custom — shows date + all three values + stale stock warning if isStockStale
// Empty state: centred text "No snapshots recorded. Add your first cash or stock snapshot to start tracking."
```

### 2.4 Summary Cards: `src/app/(authorized)/assets/_components/AssetSummaryCards.tsx`

```typescript
interface AssetSummaryCardsProps {
  latestNetWorth: number;
  latestCashTotal: number;
  latestStockTotal: number;
  latestCashDate: string | null;
  latestStockDate: string | null;
  isLoading: boolean;
}

// Three cards rendered in a responsive grid (1 col mobile, 3 col desktop):
//   Card 1: "Total Assets (AUD)"  — latestNetWorth, date of latest cash snapshot
//   Card 2: "Cash"                — latestCashTotal, date of latest cash snapshot
//   Card 3: "Stocks (AUD only)"   — latestStockTotal, date of latest stock snapshot
//
// Each card shows the AUD value formatted with $ and 2 decimal places.
// If latestCashDate is null: show "--" with helper text "No cash snapshot yet"
// If latestStockDate is null: show "$0.00" with helper text "No stock snapshot yet"
```

### Phase 2 Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 2.1 | `/assets` renders the page heading "Assets Overview" without auth error | E2E | Page loads |
| 2.2 | Summary cards show "$0.00" and "No snapshot yet" messages when no snapshots exist | E2E | Empty state for cards |
| 2.3 | Chart area shows empty state message when `dataPoints` is empty | Component | Empty state for chart |
| 2.4 | After creating a bank snapshot, summary card "Cash" updates on next page visit | E2E | Data flow end-to-end |
| 2.5 | Selecting "FISCAL" lens + a specific year shows only snapshots within that year | Component | Calendar lens filtering |
| 2.6 | Clicking "Total Assets" legend item hides the purple line; clicking again shows it | Component | Line toggle |
| 2.7 | "View Cash Detail" link navigates to `/assets/bank` | E2E | Navigation |
| 2.8 | Tooltip on chart hover shows date, Cash, Stocks, Total values | Component | Tooltip content |
| 2.9 | Stale stock tooltip warning appears when `isStockStale = true` | Component | Stale data indicator |
| 2.10 | Page is responsive: summary cards stack vertically on mobile viewport | E2E | Responsive layout |

---

## Phase 3 — Navigation: SideNav Update

### 3.1 Modification: `src/layouts/SideNav.tsx`

Add `LayoutDashboard` to lucide-react imports, then:

```typescript
// Before:
const assetItems: NavItem[] = [
  { name: 'Bank(s)', href: '/assets/bank', icon: Landmark },
  { name: 'Stock(s)', href: '/assets/stocks', icon: CandlestickChart },
];

// After:
const assetItems: NavItem[] = [
  { name: 'Overview', href: '/assets', icon: LayoutDashboard },
  { name: 'Bank(s)', href: '/assets/bank', icon: Landmark },
  { name: 'Stock(s)', href: '/assets/stocks', icon: CandlestickChart },
];
```

Also update the `isActive` check for the Asset(s) group:

```typescript
// Before:
pathname.startsWith('/assets/bank') || pathname.startsWith('/assets/stocks')

// After:
pathname.startsWith('/assets')
```

### Phase 3 Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 3.1 | "Overview" nav item appears as first item under Asset(s) group in sidebar | E2E | Nav order |
| 3.2 | Navigating to `/assets` highlights the "Overview" item as active | E2E | Active state |
| 3.3 | Asset(s) group is expanded/highlighted when on `/assets`, `/assets/bank`, or `/assets/stocks` | E2E | Group active state |
| 3.4 | Existing `Bank(s)` and `Stock(s)` nav items still navigate correctly | E2E | No regression |

---

## Migration Notes

**No Prisma migration required for any phase.** All data is derived from existing `BankBalanceSnapshot`, `BankBalanceRecord`, `PortfolioSnapshot`, and `StockHolding` records. No schema changes.

---

## Integration Points & Edge Cases

| Scenario | Handling |
|---|---|
| User has cash snapshots but zero stock snapshots | `stockTotal = 0`, `stockSnapshotId = null`, `isStockStale = false`; chart renders Cash and Total lines only |
| User has stock snapshots but zero cash snapshots | `dataPoints = []` — cash snapshot is the anchor; no data points rendered; summary cards show stock-only data from separate query |
| Portfolio snapshot exists on same date as cash snapshot | `isStockStale = false`; tooltip shows no warning |
| Multiple cash snapshots on same date (data entry error) | Service deduplicates by taking the latest `createdAt` per `snapshotDate`; or renders both as separate points — TBD by implementation |
| `Decimal` type from Prisma for `balance` and `currentPrice` | Convert with `new Decimal(value).toNumber()` — do not use `parseFloat()` directly on Decimal objects |
| Calendar year boundary: FISCAL from Jul to Jun | `fromDate = new Date(fromYear, fromMonth - 1, 1)` → `toDate = new Date(toYear, toMonth, 0, 23, 59, 59)` (last day of toMonth) |
| User selects ZAKAT lens but has no ZAKAT CalendarYear configured | Year dropdown shows empty; chart shows "No Zakat year configured" message |
| Large number of snapshots (100+) | Prisma query returns all; chart renders with scroll or date-range pagination — acceptable for personal use scale |
| USD stock holdings present | Excluded from `stockTotal`; note in UI: "Stock total reflects AUD holdings only" |
