# Expense Summary Report — Context

## Problem

`/reports/income-summary` exists; `/reports/expense-summary` does not. The information architecture is asymmetric: users can review where money comes from in a printable, structured report but have no equivalent for where it goes — the most actionable side of the cashflow equation. Today they have to leave the Reports area and use the interactive Analytics page, which is exploratory rather than report-style.

## Architecture

A new route `/reports/expense-summary` mirroring the structure of `IncomeSummaryClient` but richer:

- Period filter via `<PeriodPicker>` (default L12M with FY available).
- KPI tiles: Total Expenses · Avg Monthly · Largest Category · Largest Month — each with `<TrendDelta>` vs comparison and a `<Sparkline>`.
- **Group rollup chart** — stacked horizontal bars by category group (Non-Discretionary / Discretionary / Kids / etc.) reusing the existing `CategoryGroupRollupPanel` data shape.
- Monthly table with expandable category breakdown (mirrors `MonthlySummaryTable` from income-summary) plus a `<Sparkline>` per category and MoM delta column.
- **Top Movers** `<InsightCard>` strip at the top.
- **Recurring & Subscriptions** section (placeholder in this phase, populated by Phase 6).
- Print stylesheet + CSV export (reuses any existing export utility; otherwise add a small CSV helper).

## Scope

- New route `/reports/expense-summary` and matching server page.
- Server service: `getExpenseSummary(userId, period, comparison) → ExpenseSummary`.
- KPI tiles using `<KpiTile>`.
- Group rollup stacked bar chart.
- Monthly table with per-category sparkline + MoM delta + drill-down to `transaction.getForPeriod`.
- Top Movers insight strip via `insights.forPeriod` (filtered to expense insights only).
- Placeholder Recurring section showing "Coming soon" until Phase 6.
- Print stylesheet (`@media print`) and CSV export.
- URL state for filters.

## Out of Scope

- Recurring detection logic (Phase 6 — only the placeholder section is built here).
- Forecast / projected month-end spend (Phase 7).
- Budget vs actual rails (out of scope for this initiative).
- Side-by-side multi-period comparison view (single comparison only via Period Picker).
