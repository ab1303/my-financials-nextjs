# Context: Assets Net Worth Dashboard

## Problem Summary

The app captures Cash (`BankBalanceSnapshot`) and Stock (`PortfolioSnapshot`) positions as independent point-in-time snapshots, but there is no unified view that aggregates them into a net worth trend. Users cannot see whether their total assets are growing or shrinking over time, and the Zakat obligation calculation (which requires total assets at a given date) has no data aggregation surface. The current UX leads with a Calendar Type selector as the front door, which is a compliance/reporting mental model rather than the wealth-tracking mental model the user actually has.

---

## File Inventory

### Files to CREATE

| File | Type | Description |
|---|---|---|
| `src/app/(authorized)/assets/page.tsx` | Server Component | New Assets Dashboard landing page; replaces the missing index for the `/assets` route group |
| `src/app/(authorized)/assets/NetWorthDashboardClient.tsx` | Client Component | Interactive trend chart, calendar lens filter, summary stat cards |
| `src/app/(authorized)/assets/_components/NetWorthChart.tsx` | Client Component | Recharts `ResponsiveContainer` + `LineChart` rendering Cash / Stocks / Total lines |
| `src/app/(authorized)/assets/_components/AssetSummaryCards.tsx` | Client Component | Three stat cards: Total Assets, Cash, Stocks (current snapshot values) |
| `src/server/services/asset-dashboard.service.ts` | Service | `getNetWorthTrend()` — aggregates BankBalanceSnapshot + PortfolioSnapshot into unified time series |
| `src/server/controllers/asset-dashboard.controller.ts` | Controller | Thin controller; validates session, calls service, maps response |
| `src/server/schema/asset-dashboard.schema.ts` | Zod Schema | Input schema for `getNetWorthTrend` tRPC procedure |
| `src/server/trpc/router/asset-dashboard.ts` | tRPC Router | New `assetDashboardRouter` with `getNetWorthTrend` protected procedure |
| `src/types/asset-dashboard.types.ts` | Types | `NetWorthDataPoint`, `NetWorthTrendResponse`, `AssetDashboardSummary` |

### Files to MODIFY

| File | Change |
|---|---|
| `src/server/trpc/router/index.ts` | Register `assetDashboardRouter` under key `assetDashboard` |
| `src/layouts/SideNav.tsx` | Add "Overview" nav item at top of `assetItems` array pointing to `/assets` |

### Files Referenced (read-only)

| File | Why |
|---|---|
| `src/server/services/bank-asset.service.ts` | `getBankAssetSnapshots()` — reused for fetching cash data |
| `src/server/services/stock-asset.service.ts` | `getStockSnapshots()` — reused for fetching portfolio data |
| `src/app/(authorized)/assets/bank/page.tsx` | Pattern reference for Server Component + Client handoff |
| `src/app/(authorized)/assets/stocks/page.tsx` | Pattern reference for Server Component + Client handoff |
| `src/server/controllers/calendar-year.controller.ts` | `getCalendarYearsHandler()` — used to resolve date boundaries from CalendarYear |

---

## Relevant Schema (verbatim)

```prisma
enum CalendarEnumType {
  ZAKAT
  ANNUAL
  FISCAL
}

enum CurrencyEnumType {
  AUD
  USD
}

model CalendarYear {
  id          String           @id @default(cuid())
  description String
  fromYear    Int
  fromMonth   Int
  toYear      Int
  toMonth     Int
  type        CalendarEnumType?
  // relations omitted for brevity
}

// BankBalanceSnapshot — point-in-time snapshot header (one per date)
model BankBalanceSnapshot {
  id             String               @id @default(cuid())
  snapshotDate   DateTime
  userId         String
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([userId, snapshotDate])
}

// BankBalanceRecord — a single account's balance at one snapshot date
model BankBalanceRecord {
  id           String              @id @default(cuid())
  balance      Decimal             @db.Money
  accountId    String
  account      BankAccount         @relation(fields: [accountId], references: [id])
  snapshotId   String
  snapshot     BankBalanceSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  importImageId String?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@unique([accountId, snapshotId])
  @@index([snapshotId])
}

// PortfolioSnapshot — point-in-time portfolio snapshot header (one per date)
model PortfolioSnapshot {
  id           String         @id @default(cuid())
  snapshotDate DateTime
  userId       String
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  holdings     StockHolding[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([userId, snapshotDate])
}

// StockHolding — individual holding within a portfolio snapshot
model StockHolding {
  id           String                 @id @default(cuid())
  ticker       String
  companyName  String
  quantity     Decimal
  buyPrice     Decimal                @db.Money
  buyDate      DateTime
  currentPrice Decimal                @db.Money
  currency     CurrencyEnumType
  plannedTerm  InvestmentTermEnumType
  salePrice    Decimal?               @db.Money
  saleDate     DateTime?
  soldQuantity Decimal?
  accountId    String
  account      Business               @relation(fields: [accountId], references: [id])
  snapshotId   String
  snapshot     PortfolioSnapshot      @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  @@index([snapshotId])
  @@index([accountId])
  @@index([ticker])
}
```

**Key relationships:**
- `BankBalanceSnapshot 1 → N BankBalanceRecord N → 1 BankAccount N → 1 Business(BANK)`
- `PortfolioSnapshot 1 → N StockHolding N → 1 Business(BROKERAGE)`
- `CalendarYear` has no direct FK to either snapshot model — date-range filtering is computed

---

## Existing Patterns to Reuse

### tRPC Router Pattern
```typescript
// Pattern: src/server/trpc/router/bank-asset.ts
export const assetDashboardRouter = router({
  getNetWorthTrend: protectedProcedure
    .input(getNetWorthTrendSchema)
    .query(({ input, ctx: { session } }) =>
      getNetWorthTrendHandler({ input, userId: session.user.id }),
    ),
});
```

### Server Component → Client Handoff Pattern
```typescript
// Pattern: src/app/(authorized)/assets/bank/page.tsx
// Server Component fetches session + initial static data (e.g., calendarYears)
// Passes as props to Client Component
// Client Component owns all tRPC queries and interactive state
export default async function AssetsPage() {
  const session = await auth();
  const calendarYears = await getCalendarYearsHandler();
  return <NetWorthDashboardClient initialData={{ calendarYears }} />;
}
```

### Service Pattern
```typescript
// Pattern: src/server/services/bank-asset.service.ts
// Direct prisma calls, no business logic in router/controller
// Filters via Prisma where clauses — no in-memory filtering
export const getNetWorthTrend = async (userId: string, filters?: NetWorthTrendFilters) => { ... }
```

---

## Data Flow

### Current Flow (per asset class)
```
User → /assets/bank → Calendar Type picker → Calendar Year picker
                    → Snapshot date picker → BankAssetsClient
                    → trpc.bankAsset.getSnapshots (date-filtered)
                    → BankBalanceSnapshot[] per calendar year
                    (No aggregation, no cross-asset view)

User → /assets/stocks → same pattern, FISCAL only
                    → PortfolioSnapshot[] per fiscal year
```

### Proposed Flow
```
User → /assets (NEW) → NetWorthDashboardClient
                     → trpc.assetDashboard.getNetWorthTrend (all or lens-filtered)
                     → NetWorthDataPoint[] (unified time series)
                     → Line chart: Cash | Stocks | Total (toggleable)
                     → Summary cards: latest Cash | latest Stocks | latest Total
                     → Calendar lens filter: ALL | FISCAL | ANNUAL | ZAKAT
                        (filters date range, does not change page)
                     → "View Cash Detail" → /assets/bank (existing)
                     → "View Stock Detail" → /assets/stocks (existing)

Aggregation strategy (Last Known Value):
  For each unique snapshotDate across both asset types:
    cashTotal  = sum(balanceRecords.balance) at this snapshot
    stockTotal = sum(qty * currentPrice) for AUD holdings at nearest
                 PortfolioSnapshot on or before this date
    total      = cashTotal + stockTotal
```

---

## Known Constraints & Gotchas

1. **No chart library installed** — Recharts must be added via `pnpm add recharts`. It is the standard React chart library and SSR-safe when used in Client Components.
2. **Stock currency** — `StockHolding.currency` can be AUD or USD. For net worth totalling, only AUD holdings should be summed initially (no currency conversion in scope). USD holdings are displayed separately on the Stocks detail page.
3. **CalendarYear has no day precision** — `fromMonth`/`toMonth` only; no `fromDay`/`toDay`. Date boundary computation defaults to 1st of `fromMonth` and last day of `toMonth`. (Documented gap in `spec/calendar-attribution-architecture/analysis.md` — `fromDay`/`toDay` addition is a separate future schema change.)
4. **`BankBalanceSnapshot` has no `calendarYearId` FK** — filtering is always computed via date range. This is architecturally correct per the calendar-attribution-architecture analysis.
5. **`PortfolioSnapshot` currently only shown under FISCAL lens** in the Stocks page — the dashboard will show all snapshots regardless of calendar type for the trend view; calendar lens filtering applies a date range.
6. **`assets/page.tsx` does not exist** — the `/assets` route currently has no index page. Creating it gives the route a proper landing page.
7. **SideNav `assetItems` array** currently has `Bank(s)` and `Stock(s)`. A new "Overview" item must be added at index 0 to point to `/assets`.
