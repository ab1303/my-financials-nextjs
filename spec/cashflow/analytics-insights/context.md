# Analytics Insights Upgrade — Context

## Problem

The current `/cashflow/analytics` page shows totals and bar charts but no narrative. The fiscal-year-only period filter prevents rolling-window analysis. The Income Source chart is dominated by Employment (~91% of income), visually flattening every other source. There is no period-over-period comparison, no per-row trend indicator, and filter state is not in the URL — so insights aren't shareable.

## Architecture

This phase wires the Phase 0 primitives + Phase 1 engine into the existing `CashflowAnalyticsClient`:

- Replace `CalendarYearPicker` with `<PeriodPicker>` (compare-to enabled).
- Add `<InsightStrip>` at the top of the page consuming `insights.forPeriod`.
- Add `<Sparkline>` + `<TrendDelta>` columns to the Income Source and Expense Category breakdown rows.
- Income Source chart: collapse to **Top 5 + Other** with a log-scale toggle in the chart header.
- `IncomeExpenseTrendChart` and `NetCashflowChart`: render a faint comparison series when `comparison !== null`.
- Encode `{period, comparison, bank, categories}` in the URL query string via `usePeriodQueryState` so the page is deep-linkable.

Existing drill-down behaviour (`AnalyticsDrillDownDrawer`) is preserved; insights' `drillDownFilter` opens the same drawer.

## Scope

- Replace year picker with `<PeriodPicker>` (preserving FY behaviour by default).
- New `InsightStrip` component (Analytics-local) consuming `insights.forPeriod`.
- Sparkline + delta on each row in `IncomeSourceChart` and `ExpenseCategoryChart`.
- Top-5 + Other grouping with log-scale toggle on `IncomeSourceChart`.
- Comparison overlay (lighter line/bars) on `IncomeExpenseTrendChart` and `NetCashflowChart`.
- Full URL state for filters; back/forward navigation works.
- Drill-down drawer continues to function unchanged; insight cards link into it.

## Out of Scope

- Forecast tail on Net Cashflow (Phase 7).
- Anomaly bands per category on bar charts (Phase 7).
- Recurring transactions filter chip (Phase 6).
- Removing the existing analytics-dashboard spec — this layers on top.
- Mobile-specific layout adjustments.
