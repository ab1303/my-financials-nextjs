# HLD: Assets Net Worth Dashboard

## Problem & Proposed Solution

The app's Asset section currently consists of two disconnected detail pages: Bank Assets (cash snapshots) and Stock Assets (portfolio snapshots). Users must visit each page separately and mentally combine the numbers to understand their total wealth position. There is no trend view, no combined total, and no answer to the question "are my assets growing?". For the Zakat use case, total assets at a specific date are required for obligation calculation — this currently cannot be derived from the app.

The proposed solution is a new **Assets Overview** page at `/assets` that aggregates cash and stock snapshots into a unified net worth time series, visualised as a line chart. The existing Bank(s) and Stock(s) pages remain unchanged as detail drill-downs. No schema changes are required. Calendar year filtering becomes a secondary lens on the trend chart rather than the primary navigation entry point.

---

## Architecture Decisions

### 1. New `/assets` landing page — no route changes to existing pages
**Decision:** Create `src/app/(authorized)/assets/page.tsx` as the new Assets Dashboard. The existing `/assets/bank` and `/assets/stocks` pages remain at their current URLs and are unchanged functionally.  
**Rationale:** Avoids breaking existing navigation links and bookmarks. The Assets group in SideNav gains an "Overview" entry at the top. The Bank(s) and Stock(s) items remain as-is.

### 2. Cash and Stock snapshots remain independent — aggregation at read time only
**Decision:** No schema changes. `BankBalanceSnapshot` and `PortfolioSnapshot` continue as separate models with no FK relationship between them.  
**Rationale:** Snapshot frequency differs per asset class (user may snapshot cash without checking stock prices). Forcing a unified snapshot event adds friction and is not how any major app structures this data internally. Aggregation is computed in `asset-dashboard.service.ts` at query time using the "last known value" strategy.

### 3. Last Known Value aggregation strategy
**Decision:** For the net worth time series, each `BankBalanceSnapshot` date is an anchor point. The corresponding stock value is taken from the most recent `PortfolioSnapshot` on or before that date. If no stock snapshot exists before a cash anchor, `stockTotal = 0` (clearly communicated in the UI with a note).  
**Rationale:** Quarterly cash snapshots and quarterly stock snapshots are unlikely to land on the exact same date. The "last known value" strategy is the standard approach used in financial charting (used by Empower, Wealthica, Sharesight) and produces a coherent Total Assets line without requiring the user to synchronise snapshot dates.

### 4. Recharts for chart visualisation — installed as new dependency
**Decision:** Add `recharts` via `pnpm add recharts`. Use `ResponsiveContainer` + `LineChart` with three `Line` components: Cash (blue), Stocks (green), Total Assets (purple, bold). Lines are independently toggleable via a legend.  
**Rationale:** Recharts is the most widely adopted React chart library, is SSR-safe in Client Components, has zero native dependencies, and integrates cleanly with Tailwind via `className` props. No alternative chart libraries are currently installed; Tremor/shadcn charts are Recharts wrappers anyway.

### 5. Calendar lens filter as secondary — not front door
**Decision:** The dashboard defaults to showing ALL snapshots (no date filter). A Calendar Lens selector (ALL / FISCAL / ANNUAL / ZAKAT + year picker) filters the chart to a specific year's date range when selected.  
**Rationale:** The primary mental model is wealth tracking over time, not compliance reporting. The calendar lens is a secondary analytical tool (e.g., "what were my assets during Zakat year 1446H?"). Leading with it buries the trend view, which is where the user's primary value lies.

### 6. AUD-only net worth total — USD stocks excluded from Total Assets line
**Decision:** `stockTotal` in the trend computation sums only `StockHolding` records where `currency = AUD`. USD holdings appear in the Stocks detail page with separate totals but are excluded from the unified net worth number.  
**Rationale:** No currency conversion is in scope. Including USD at a fixed or stale exchange rate would produce a misleading net worth number. The UI should clearly label this as "AUD Assets".

### 7. No Basiq / bank API integration in this phase
**Decision:** Manual snapshot entry remains the only way to update asset values. Basiq integration is deferred to a future phase.  
**Rationale:** The trend chart is the primary value delivered by this feature. Manual quarterly snapshots are the user's stated preference. Basiq adds engineering complexity ($0.50/user/month cost) and is a separate 2–4 week integration effort. Adding a "Refresh" button backed by Basiq is a clean Phase 3 addition to this same page.

### 8. New `assetDashboardRouter` — separate from `bankAssetRouter` and `stockAssetRouter`
**Decision:** Create a new tRPC router `asset-dashboard.ts` with a single `getNetWorthTrend` procedure. Do not add to existing routers.  
**Rationale:** The net worth trend query spans both asset types — it does not belong logically in either `bankAssetRouter` or `stockAssetRouter`. A dedicated `assetDashboardRouter` keeps cross-cutting concerns isolated and leaves existing routers unchanged.

### 9. SideNav "Overview" item added to Asset(s) group
**Decision:** Add `{ name: 'Overview', href: '/assets', icon: LayoutDashboard }` as the first item in `assetItems` in `SideNav.tsx`.  
**Rationale:** The Assets group currently has no landing page. Users navigating to the group see Bank(s) as the default, which is the wrong entry point for the new flow. An "Overview" item gives the group a clear starting point.

---

## Data Model Changes

**No Prisma schema changes required for Phase 1 and Phase 2.**

The `getNetWorthTrend` service computes a derived time series from existing models:

```
BankBalanceSnapshot(userId, snapshotDate)
  → [BankBalanceRecord] → SUM(balance) = cashTotal

PortfolioSnapshot(userId, snapshotDate)
  → [StockHolding WHERE currency=AUD] → SUM(quantity * currentPrice) = stockTotal

NetWorthDataPoint {
  date:            snapshotDate (from BankBalanceSnapshot)
  cashTotal:       sum of BankBalanceRecord.balance
  stockTotal:      sum from nearest PortfolioSnapshot on or before date (AUD only)
  netWorthTotal:   cashTotal + stockTotal
  cashSnapshotId:  BankBalanceSnapshot.id
  stockSnapshotId: PortfolioSnapshot.id | null
}
```

**Future schema change (deferred, see calendar-attribution-architecture spec):**  
Add `fromDay Int?` and `toDay Int?` to `CalendarYear` for precise Zakat boundary calculation. Not blocking this feature.

---

## Component & Service Changes

### New Service
| Function | Location | Description |
|---|---|---|
| `getNetWorthTrend(userId, filters?)` | `asset-dashboard.service.ts` | Core aggregation: fetches BankBalanceSnapshots + PortfolioSnapshots, builds `NetWorthDataPoint[]` |

### New tRPC Router + Controller
| Item | Location | Description |
|---|---|---|
| `assetDashboardRouter` | `router/asset-dashboard.ts` | `getNetWorthTrend` protected procedure |
| `getNetWorthTrendHandler` | `controllers/asset-dashboard.controller.ts` | Session extract, input validation, service call |

### New Pages & Components
| Item | Location | Description |
|---|---|---|
| `AssetsPage` | `assets/page.tsx` | Server Component; fetches calendarYears, passes to Client |
| `NetWorthDashboardClient` | `assets/NetWorthDashboardClient.tsx` | Client Component; owns chart state, lens filter, tRPC query |
| `NetWorthChart` | `assets/_components/NetWorthChart.tsx` | Recharts line chart; Cash / Stocks / Total lines; toggleable via legend |
| `AssetSummaryCards` | `assets/_components/AssetSummaryCards.tsx` | Three cards: Total Assets, Cash, Stocks (latest snapshot values + MoM delta) |

### Modified Files
| File | Change |
|---|---|
| `router/index.ts` | `assetDashboard: assetDashboardRouter` |
| `SideNav.tsx` | Add "Overview" item; add `LayoutDashboard` icon import |

---

## Success Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | `/assets` loads without error and displays the trend chart | Navigate to `/assets` — chart renders with at least empty state |
| 2 | Adding cash snapshots on Bank Assets page updates the chart on next visit to `/assets` | Create a snapshot, navigate to Overview, verify new data point appears |
| 3 | Calendar lens filter (FISCAL / ANNUAL / ZAKAT) restricts chart to correct date range | Select "Fiscal Year 2024-2025", verify only snapshots within Jul 2024–Jun 2025 show |
| 4 | Toggling a line (Cash / Stocks / Total) in the chart legend hides/shows it | Click legend item, verify line disappears/reappears |
| 5 | Summary cards show latest cash total, latest stock total, and combined net worth | Verify card values match the most recent snapshots of each type |
| 6 | USD stock holdings are excluded from the Total Assets calculation | Add USD-currency holding to a stock snapshot; verify it does not appear in Total |
| 7 | "Overview" item appears first in the Asset(s) sidebar group and navigates to `/assets` | Verify SideNav, click Overview |
| 8 | Existing `/assets/bank` and `/assets/stocks` pages are unaffected | Navigate to each; verify full functionality |
| 9 | Empty state renders correctly when no snapshots exist | Use an account with no data; verify "No snapshots recorded" message in chart area |

---

## Out of Scope / Future Phases

| Item | Phase | Rationale |
|---|---|---|
| Basiq bank API integration ("Refresh" button) | Phase 3 | 2–4 week integration; separate PRD required |
| Zakat Nisab calculation on the dashboard | Future | Requires Nisab threshold input and `fromDay`/`toDay` schema change |
| Super / property manual asset tracking | Future | New asset class; new model required |
| USD-to-AUD conversion for combined total | Future | Requires FX rate feed or manual rate entry |
| `fromDay`/`toDay` on CalendarYear for precise Zakat boundaries | Future | Non-blocking additive schema change |
| Email-based CommSec trade confirmation import | Future | Requires email infrastructure (SendGrid Inbound Parse) |
| BankAccount management page (Phase 6 of bank PRD) | Separate | Edit account name; not related to dashboard |
| Stock assets with ANNUAL / ZAKAT calendar lenses | Future | Currently FISCAL-only by stock PRD v1.1 |
| Dashboard drill-down: click chart point → opens snapshot detail | Future | UX polish post-MVP |
| Net worth export (CSV / PDF) | Future | Reporting feature |
| Year-over-year comparison cards | Future | Nice-to-have insight; add after chart is live |
