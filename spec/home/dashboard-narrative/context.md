# Home Dashboard Narrative — Context

## Problem

The Home page (`/home`) renders independent widget tiles — `AssetBalanceCards`, `CashflowPulseCard`, `MonthlyTrendWidget`, `NetWorthWidget`, `TopExpensesWidget`, `RecentTransactionsWidget`. They show data but don't form a narrative. A returning user has to scan all tiles to figure out what's worth their attention this visit. There is no single "what changed since I last looked?" surface.

## Architecture

Add a narrative hero strip + a heads-up column without rewriting the existing widgets:

- **`TodaysSignalStrip`** — three high-signal `<KpiTile>`s above the existing widget grid:
  - Savings rate (this month) with delta vs last month + sparkline.
  - Top mover this month (category + delta + sparkline) — clickable into Analytics drill-down.
  - Projected month-end cashflow (Phase 7 fills in the projection; phase 5 ships with current-pace projection as a degenerate forecast).
- **`HeadsUpInsightColumn`** — sidebar (or stacked card on narrow viewports) showing top 3 `<InsightCard>`s from `insights.forPeriod` for the current calendar month. Dismissible per-session.
- Replace the existing flat KPI markup in `CashflowPulseCard` with `<KpiTile>` for visual parity with the new strip.

Existing widgets stay where they are; the narrative layer is purely additive.

## Scope

- New `TodaysSignalStrip` component above the existing widget grid.
- New `HeadsUpInsightColumn` sidebar consuming `insights.forPeriod` for MTD.
- Refit `CashflowPulseCard` to use `<KpiTile>` (no logic change).
- Session-storage-based dismissal for individual insights.
- Period for Home is **always** "MTD with prior-month comparison" — no user-controlled period picker on Home (Home is glanceable; Analytics is for exploration).

## Out of Scope

- Removing or restructuring existing widgets.
- A configurable dashboard / draggable widgets (separate effort if ever wanted).
- Server-side dismissal persistence (sessionStorage only for now).
- Phase 7's true forecast — Phase 5 ships with current-pace linear projection as a placeholder.
