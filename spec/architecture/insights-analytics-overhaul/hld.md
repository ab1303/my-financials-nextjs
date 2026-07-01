# Insights & Analytics Overhaul — High-Level Design (HLD)

## Problem & Proposed Solution

The current analytics surfaces (Home dashboard, `/cashflow/analytics`, `/reports/income-summary`, no Expense Summary) display *what* happened but never *so what*. Users see bars and totals but must do the analysis themselves: which category is the leading factor, which line items are trending up, how this period compares to last. The fiscal-year + bank-account filter pair also blocks rolling windows and period-over-period comparison — patterns that are table-stakes in Monarch, Copilot, YNAB, Rocket Money, and Empower.

This initiative reshapes the four surfaces around three pillars:

1. **Comparable time periods.** Replace the single fiscal-year picker with a flexible Period Picker supporting MTD / L3M / L6M / L12M / YTD / FY / Custom plus a "compare to" axis (prior period / prior year / none).
2. **Always-on trend signals.** Every category/source row gets a sparkline plus a delta chip; the dominant Income Source chart switches to Top-N + Other with a log-scale escape; the Net Cashflow chart gains a dashed forecast tail.
3. **Insight-first narrative.** A shared insights engine produces ranked `Insight[]` (top movers, anomalies, savings-rate trend, recurring leaks). Home shows the top 1–3 as a "Today's Signal" hero; Analytics and the Summary reports show the full strip at the top.

The initiative is executed in **eight independent phases**, each its own spec bundle, each shipping value standalone. Phases 0 + 1 are strict foundations; phases 2–5 can run in parallel after that; 6 + 7 are optional enhancements.

## Architecture Decisions

1. **Build-once UI primitives.** `<PeriodPicker>`, `<TrendDelta>`, `<Sparkline>`, `<InsightCard>`, `<KpiTile>` live under `src/components/insights/` and are consumed by every surface. No surface gets a bespoke version.
2. **Single server-side insights engine.** A pure function `computeInsights(period, comparison, txns) → Insight[]` lives in `src/server/services/insights/`. All four surfaces consume the same engine via tRPC. This guarantees that the "top mover" on Home matches the "top mover" on Analytics.
3. **Period model lives in shared types.** `DateRange`, `PeriodPreset`, and `ComparisonMode` types live in `src/types/period.ts`. The legacy `CalendarYearPicker` continues to power calendar-year-scoped flows (assets, zakat) and is **not** removed.
4. **URL state for filters.** Analytics and Summary reports serialise `{period, comparison, bank, categories}` into the query string so insights are bookmarkable and the browser Back button is meaningful. Home stays session-stateful.
5. **No schema changes for phases 0–5.** Insights are computed from existing `Transaction` / `ExpenseCategory` / `IncomeSource` tables. Phase 6 (Recurring detection) introduces a single new table; Phase 7 (Forecasting) is pure computation.
6. **Charting strategy unchanged.** Continue with the existing Chart.js stack used in `NetCashflowChart` / `IncomeExpenseTrendChart`. Sparklines render as inline SVG (lightweight, no per-cell chart instance).
7. **Insight cards are dismissible client-side only.** No user-preference table; dismissal lives in `sessionStorage` keyed by insight signature. Re-opening the page re-evaluates.
8. **Dark mode + Flowbite parity from day 1.** Every primitive ships with `dark:` variants and matches the existing Flowbite-migrated palette (see `spec/FLOWBITE_MIGRATION.md`).

## Data Model Changes (Schema Diff)

- **Phases 0–5:** none.
- **Phase 6 (Recurring detection):** new `RecurringSeries` table (id, userId, payeeKey, cadence, expectedAmount, confidence, firstSeenAt, lastSeenAt, status) + nullable `recurringSeriesId` FK on `Transaction`. Migration name: `add_recurring_series`.
- **Phase 7 (Forecasting):** none — pure computation over existing rows.

## Component/Service Changes (High-Level)

| Layer | Phase | Change |
|---|---|---|
| UI primitives | 0 | `src/components/insights/{PeriodPicker,TrendDelta,Sparkline,InsightCard,KpiTile}.tsx` |
| Types | 0 | `src/types/period.ts` |
| Hooks | 0 | `src/hooks/usePeriodQueryState.ts` (URL-state binding) |
| Server | 1 | `src/server/services/insights/compute-insights.ts` + tRPC `insights.forPeriod` |
| Cashflow Analytics | 2 | `CashflowAnalyticsClient` swaps year picker → PeriodPicker; renders InsightStrip; sparklines on rows |
| Reports | 3 | New `/reports/expense-summary` route mirroring income-summary structure |
| Reports | 4 | `/reports/income-summary` gains donut + monthly chart + sparkline column |
| Home | 5 | `home/page.tsx` adds `TodaysSignalStrip` + `HeadsUpInsightColumn`; replaces flat KPI tiles |
| Cashflow | 6 | `src/server/services/recurring/` + admin UI in Expense Summary |
| Cashflow | 7 | `src/server/services/forecast/` + dashed-line overlay in `NetCashflowChart` |

## Success Criteria

- A user can answer "what's my biggest expense category right now and is it trending up?" without leaving the page they land on.
- Period Picker offers MTD, L3M, L6M, L12M, YTD, FY, Custom; comparison toggle works on every Analytics chart and every Summary report.
- An Expense Summary report exists at `/reports/expense-summary` with parity to `/reports/income-summary` plus group rollup and recurring section.
- Income Summary shows a source breakdown chart + monthly trend + sparkline per row + Income Stability KPI.
- Home dashboard's hero strip surfaces ≥1 insight per visit when data exists.
- All filter state on Analytics and Summary reports is in the URL; deep links work after a hard refresh.
- Each phase passes the Verification Gate (`type-check` + `lint` + build + screenshot for UI work).
- No regression in existing surfaces during foundation phases (0 + 1).

## Out of Scope / Future Phases

| Area | In Scope (this initiative) | Out of Scope / Future |
|---|---|---|
| Period picker + comparison | ✅ Phase 0 + 2 | |
| Cross-surface insights engine | ✅ Phase 1 | |
| Sparklines & trend deltas | ✅ Phase 0 + 2 | |
| Expense Summary report | ✅ Phase 3 | |
| Income Summary v2 | ✅ Phase 4 | |
| Home narrative strip | ✅ Phase 5 | |
| Recurring/subscription detection | ✅ Phase 6 | |
| Forecast + anomaly bands | ✅ Phase 7 | |
| Budgets / goals (budget-vs-actual rails) | | ✅ Separate domain |
| Multi-currency rollups beyond existing | | ✅ |
| AI-generated narrative summaries | | ✅ Possible Phase 8, must be grounded in Phase 1 insights |
| Mobile-specific layouts | | ✅ Desktop-first; existing responsive rules apply |
| Removing the legacy `CalendarYearPicker` | | ✅ Out of scope — still used by assets/zakat |

## Phase Sequencing

```
[0a Period Picker]   [0b Insight Primitives]
       \                /
        \              /
         [1 Insights Engine]
        /      |      |      \
       /       |      |       \
   [2 Analytics] [3 Expense] [4 Income] [5 Home]
       |              |
       |          [6 Recurring]
       |
   [7 Forecasting]
```

Phases 0a and 0b can be developed in parallel. Phase 1 depends on both. Phases 2–5 are independent after Phase 1. Phase 6 depends on Phase 3 (Expense Summary is its primary surface). Phase 7 depends on Phase 2 (forecast line lives in the Analytics Net Cashflow chart).

## Build Order

Deliver phases in the order below. Each row is a single reviewable PR = one deliverable. Later rows must not start until every phase in the "Prerequisites" column has merged to `main`.

| Order | Deliverable | Phase(s) | Spec | Prerequisites | Parallelisable with |
|---|---|---|---|---|---|
| **1** | Foundations — period model + UI primitives | 0a + 0b | `spec/architecture/period-picker/` · `spec/architecture/insight-primitives/` | — | 0a ↔ 0b (internal) |
| **2** | Server-side insights engine | 1 | `spec/cashflow/insights-engine/` | Order 1 | — |
| **3** | Cashflow Analytics upgrade | 2 | `spec/cashflow/analytics-insights/` | Order 2 | Orders 4, 5, 6 |
| **4** | Expense Summary report (new) | 3 | `spec/reports/expense-summary/` | Order 2 | Orders 3, 5, 6 |
| **5** | Income Summary v2 | 4 | `spec/reports/income-summary-v2/` | Order 2 | Orders 3, 4, 6 |
| **6** | Home dashboard narrative | 5 | `spec/home/dashboard-narrative/` | Order 2 | Orders 3, 4, 5 |
| **7** | Recurring & subscriptions detection | 6 | `spec/cashflow/recurring-detection/` | Order 4 | Order 8 |
| **8** | Forecasting & anomalies | 7 | `spec/cashflow/forecasting/` | Order 3 | Order 7 |

### Why this order

1. **Foundations first (Order 1).** Every later phase consumes `<PeriodPicker>`, `<Sparkline>`, `<TrendDelta>`, `<InsightCard>`, `<KpiTile>`. Building them once, in one PR, eliminates drift across surfaces.
2. **Engine before surfaces (Order 2).** All four analytics surfaces call the same `insights.forPeriod` procedure. If surfaces ship before the engine, each invents its own ad-hoc "top mover" logic and they will disagree.
3. **Analytics first among surfaces (Order 3).** It's the highest-traffic analytics surface and the one with the widest gap. It also produces the reference implementation for period-picker + insight-strip patterns that Orders 4–6 will copy.
4. **Expense Summary before Income v2 and Home (Orders 4 → 5 → 6).** Expense Summary is entirely new (fills the biggest IA gap). Income v2 and Home are enhancements to existing surfaces and lower risk. Delivering them after Expense Summary means the Recurring section (Order 7) has a home to land in immediately.
5. **Recurring after Expense Summary (Order 7).** The primary surface for recurring subscriptions is inside Expense Summary. Building recurring first would leave detected series with nowhere to render.
6. **Forecasting last (Order 8).** Forecast line renders on the Net Cashflow chart owned by Order 3. Anomaly bands render on the Expense Category chart also owned by Order 3. Both consume recurring data from Order 7 for accurate baselines — hence last.

### Sequential vs parallel

- Orders 1 → 2 → 3 are strictly sequential (each unlocks the next).
- Orders 3, 4, 5, 6 can be worked in parallel branches once Order 2 is merged, but each is a **separate PR**.
- Orders 7 and 8 can run in parallel once their respective prerequisites are merged.

### Recommended minimum viable release cuts

- **MVR-1 (unlocks core value):** Orders 1 + 2 + 3 — Analytics page now has period comparison, insight strip, sparklines. This alone answers the original user complaint about "no insights are surfaced".
- **MVR-2 (IA symmetry + narrative):** Add Orders 4 + 5 + 6 — new Expense Summary, Income v2, Home hero strip. Feature parity across surfaces.
- **MVR-3 (advanced):** Add Orders 7 + 8 — subscriptions detection + forecasting. The "wow" phase.

Ship at any MVR boundary; do not ship mid-order.

