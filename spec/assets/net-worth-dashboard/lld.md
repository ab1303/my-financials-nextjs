# Net Worth Dashboard — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1** | `asset-dashboard.service.ts`, `asset-dashboard.ts` router, `root.ts` | Service + tRPC procedure |
| **2** | `assets/page.tsx`, `NetWorthDashboardClient.tsx`, `NetWorthChart.tsx`, `AssetSummaryCards.tsx` | Frontend |
| **3** | `SideNav.tsx` | Add "Overview" nav item |

---

## Dependency

```bash
pnpm add recharts
```

---

## Phase 1 — Service

**File:** `src/server/services/asset-dashboard.service.ts`

```typescript
export interface NetWorthDataPoint {
  date:            string;    // ISO date from BankBalanceSnapshot.snapshotDate
  cashTotal:       number;    // sum of BankBalanceRecord.balance
  stockTotal:      number;    // sum of AUD StockHolding.quantity * currentPrice
  netWorthTotal:   number;
  cashSnapshotId:  string;
  stockSnapshotId: string | null;
}

export interface NetWorthTrendFilters {
  calendarYearId?: string;
}

export async function getNetWorthTrend(
  userId: string,
  filters?: NetWorthTrendFilters,
): Promise<NetWorthDataPoint[]> {
  // 1. Resolve date range from calendarYearId if provided
  let dateFilter: { gte?: Date; lte?: Date } = {};
  if (filters?.calendarYearId) {
    const year = await prisma.calendarYear.findUnique({ where: { id: filters.calendarYearId } });
    if (year) {
      dateFilter = {
        gte: new Date(year.fromYear, year.fromMonth - 1, year.fromDay ?? 1),
        lte: new Date(year.toYear,   year.toMonth - 1,   year.toDay ?? lastDayOfMonth(year.toYear, year.toMonth)),
      };
    }
  }

  // 2. Fetch all BankBalanceSnapshots for the user in date range
  const cashSnapshots = await prisma.bankBalanceSnapshot.findMany({
    where:   { userId, ...(Object.keys(dateFilter).length > 0 && { snapshotDate: dateFilter }) },
    include: { balanceRecords: true },
    orderBy: { snapshotDate: 'asc' },
  });

  // 3. Fetch all PortfolioSnapshots with AUD holdings
  const portfolioSnapshots = await prisma.portfolioSnapshot.findMany({
    where:   { userId },
    include: { holdings: { where: { currency: 'AUD' } } },
    orderBy: { snapshotDate: 'asc' },
  });

  // 4. For each cash snapshot, compute NetWorthDataPoint using Last Known Value
  return cashSnapshots.map((cashSnap) => {
    const cashTotal = cashSnap.balanceRecords.reduce((sum, r) => sum + Number(r.balance), 0);

    // Find most recent portfolio snapshot on or before this cash snapshot date
    const nearestPortfolio = portfolioSnapshots
      .filter((p) => p.snapshotDate <= cashSnap.snapshotDate)
      .at(-1) ?? null;

    const stockTotal = nearestPortfolio
      ? nearestPortfolio.holdings.reduce(
          (sum, h) => sum + Number(h.quantity) * Number(h.currentPrice),
          0,
        )
      : 0;

    return {
      date:            cashSnap.snapshotDate.toISOString().split('T')[0]!,
      cashTotal,
      stockTotal,
      netWorthTotal:   cashTotal + stockTotal,
      cashSnapshotId:  cashSnap.id,
      stockSnapshotId: nearestPortfolio?.id ?? null,
    };
  });
}
```

---

## Phase 1 — tRPC Router

**File:** `src/server/api/routers/asset-dashboard.ts`

```typescript
export const assetDashboardRouter = createTRPCRouter({
  getNetWorthTrend: protectedProcedure
    .input(z.object({ calendarYearId: z.string().optional() }))
    .query(async ({ ctx, input }) =>
      getNetWorthTrend(ctx.session.user.id, { calendarYearId: input.calendarYearId })),
});
```

Register in `src/server/api/root.ts`:
```typescript
assetDashboard: assetDashboardRouter,
```

---

## Phase 2 — Page + Components

### `assets/page.tsx` (Server Component)

```typescript
export default async function AssetsPage() {
  const session      = await auth();
  const calendarYears = await db.calendarYear.findMany({ where: { userId: session!.user.id } });
  return <NetWorthDashboardClient calendarYears={calendarYears} />;
}
```

### `NetWorthDashboardClient.tsx` (Client Component)

```typescript
interface Props {
  calendarYears: CalendarYear[];
}

export default function NetWorthDashboardClient({ calendarYears }: Props) {
  const [selectedYearId, setSelectedYearId] = useState<string | undefined>();

  const { data, isLoading } = api.assetDashboard.getNetWorthTrend.useQuery({
    calendarYearId: selectedYearId,
  });

  return (
    <>
      {/* Calendar lens selector */}
      <AssetSummaryCards data={data} />
      <NetWorthChart data={data ?? []} />
    </>
  );
}
```

### `NetWorthChart.tsx` (Client Component)

```typescript
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export function NetWorthChart({ data }: { data: NetWorthDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <XAxis dataKey="date" />
        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
        <Legend />
        <Line type="monotone" dataKey="cashTotal"     stroke="#3b82f6" name="Cash"         strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="stockTotal"    stroke="#22c55e" name="Stocks (AUD)"  strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="netWorthTotal" stroke="#a855f7" name="Total Assets"  strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### `AssetSummaryCards.tsx`

Three cards: Total Assets, Cash, Stocks. Each shows latest value + delta from previous data point.

---

## Phase 3 — SideNav

In `src/components/layout/SideNav.tsx`, add to `assetItems`:
```typescript
{ name: 'Overview', href: '/assets', icon: LayoutDashboard },
// (existing) Bank(s), Stocks items remain unchanged
```

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | `/assets` loads and displays trend chart | Navigate to `/assets` |
| 2 | Adding cash snapshots updates chart on next visit | Create snapshot, navigate to Overview |
| 3 | Calendar lens filter restricts chart to correct date range | Select "Fiscal Year 2024-2025" |
| 4 | Toggling a line hides/shows it | Click legend item |
| 5 | Summary cards show latest cash total, stock total, combined net worth | Verify values |
| 6 | USD holdings excluded from Total Assets | Add USD holding; verify not in Total |
| 7 | "Overview" item appears first in Assets sidebar | Verify SideNav |
| 8 | Existing `/assets/bank` and `/assets/stocks` pages unaffected | Navigate to each |
| 9 | Empty state when no snapshots exist | Use account with no data |

---

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/asset-dashboard.service.ts` | CREATE | `getNetWorthTrend` aggregation service |
| `src/server/api/routers/asset-dashboard.ts` | CREATE | `assetDashboardRouter` with `getNetWorthTrend` |
| `src/server/api/root.ts` | MODIFY | Register `assetDashboard` router |
| `src/app/(authorized)/assets/page.tsx` | CREATE | Server Component shell |
| `src/app/(authorized)/assets/NetWorthDashboardClient.tsx` | CREATE | Client Component: chart state, lens, tRPC query |
| `src/app/(authorized)/assets/_components/NetWorthChart.tsx` | CREATE | Recharts line chart (3 lines) |
| `src/app/(authorized)/assets/_components/AssetSummaryCards.tsx` | CREATE | Three summary cards with delta |
| `src/components/layout/SideNav.tsx` | MODIFY | Add "Overview" as first item in assetItems |
