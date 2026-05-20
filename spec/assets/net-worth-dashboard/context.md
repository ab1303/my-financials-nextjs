# Net Worth Dashboard — Context

## Problem

The app's Asset section has no landing page. Users navigating to Assets see Bank(s) as the default entry, which is the wrong entry point. There is no way to see total wealth (cash + stocks combined), no trend view, and no answer to "are my assets growing?". For Zakat, total assets at a specific date cannot be derived without visiting both pages and doing mental arithmetic.

## Domain Dependencies

- Uses: `BankBalanceSnapshot`, `PortfolioSnapshot`, `NetWorthDataPoint` models from domain HLD
- Patterns: "Last Known Value" aggregation (each BankBalanceSnapshot date = anchor; stockTotal from nearest PortfolioSnapshot on or before that date); `ResponsiveContainer` + `LineChart` from `recharts`
- Related features: bank-assets (source of `BankBalanceSnapshot` data), stocks-tracking (source of `PortfolioSnapshot` data), settings/calendar (calendar lens filter uses CalendarYear model)

## Scope

**In scope:**
- New `/assets` page as Assets Overview landing
- `getNetWorthTrend` tRPC procedure — aggregates BankBalanceSnapshots + PortfolioSnapshots → `NetWorthDataPoint[]`
- Line chart: Cash (blue), Stocks (green), Total Assets (purple, bold); toggleable lines via legend
- Summary cards: Total Assets, Cash, Stocks (latest values + MoM delta)
- Calendar lens filter: ALL / FISCAL / ANNUAL / ZAKAT + year picker
- "Overview" item added first in Assets sidebar group
- AUD-only total (USD holdings excluded from Total Assets line, shown separately in stocks detail)

**Out of scope:**
- Basiq bank API integration ("Refresh" button) — Phase 3
- Zakat Nisab calculation
- Property / superannuation tracking
- USD-to-AUD conversion
- Dashboard drill-down (click chart point → snapshot detail)
- Net worth export

## Known Constraints

- No schema changes required for Phase 1 and Phase 2
- `stockTotal` sums only `StockHolding` where `currency = AUD` — UI must clearly label as "AUD Assets"
- If no `PortfolioSnapshot` exists before a cash anchor, `stockTotal = 0` (communicated in UI with a note)
- `recharts` must be added as a new dependency: `pnpm add recharts`

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/asset-dashboard.service.ts` | CREATE | `getNetWorthTrend(userId, filters?)` — core aggregation |
| `src/server/api/routers/asset-dashboard.ts` | CREATE | `assetDashboardRouter` with `getNetWorthTrend` procedure |
| `src/server/api/root.ts` | MODIFY | Register `assetDashboard` router |
| `src/app/(authorized)/assets/page.tsx` | CREATE | Server Component: fetches calendarYears, passes to client |
| `src/app/(authorized)/assets/NetWorthDashboardClient.tsx` | CREATE | Client Component: chart state, lens filter, tRPC query |
| `src/app/(authorized)/assets/_components/NetWorthChart.tsx` | CREATE | Recharts line chart: Cash / Stocks / Total lines |
| `src/app/(authorized)/assets/_components/AssetSummaryCards.tsx` | CREATE | Three cards: Total Assets, Cash, Stocks |
| `src/components/layout/SideNav.tsx` | MODIFY | Add "Overview" item first in assetItems |
