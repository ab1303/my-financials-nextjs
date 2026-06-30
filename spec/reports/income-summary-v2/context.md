# Income Summary v2 — Context

## Problem

`/reports/income-summary` is currently a flat table with three KPI cards (Total / Avg Monthly / Months Recorded) and expandable rows showing per-source amounts. It has:

- No chart of any kind — no source breakdown, no monthly trend visual.
- No comparison vs prior period or prior year.
- No per-source trend signal (sparkline / delta).
- No measure of income **stability** — a single freelance month skews the picture and the report doesn't surface it.

## Architecture

Layer the Phase 0 primitives + Phase 1 engine onto the existing report. The current `IncomeSummaryClient` and `MonthlySummaryTable` are retained and enhanced — no rewrite.

New elements:

- `<PeriodPicker>` replacing the bare fiscal-year `<Select>` (FY remains the default preset).
- Four `<KpiTile>` cards including a new **Income Stability** tile (coefficient of variation of monthly income over the period; lower = more stable).
- Monthly trend line chart (income only, with optional comparison overlay).
- Source breakdown donut chart with Top-5 + Other grouping.
- Sparkline + MoM delta column on each source row in the expandable breakdown.
- `<InsightStrip>` consuming `insights.forPeriod` filtered to income-relevant insights (income concentration, top mover sources, anomaly months).

## Scope

- Add `<PeriodPicker>` + URL state (`usePeriodQueryState`).
- Replace existing KPI cards with `<KpiTile>` (Total, Avg Monthly, Largest Source, Income Stability).
- Add monthly trend line chart with optional comparison series.
- Add source breakdown donut (Top-5 + Other).
- Add sparkline + delta column inside `SourceBreakdownRow`.
- Wire `<InsightStrip>` (income-scoped insights).
- Extend service `getIncomeSummary` to compute stability metric + sparkline data + comparison.

## Out of Scope

- Print/CSV export — defer until parity with Expense Summary v1 is reviewed.
- Forecast tail on monthly trend (Phase 7 concept; income forecasting is lower priority).
- Per-source budgeting / target lines (out of scope).
- Removing the existing income-summary spec — this is a v2 layered enhancement.
