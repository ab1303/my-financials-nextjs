# Cashflow Forecasting & Anomalies — Context

## Problem

Once users can see *what* happened (Phases 0–5) and *what's recurring* (Phase 6), the natural next question is *what's about to happen*. The existing Net Cashflow chart on `/cashflow/analytics` ends abruptly at "today" and tells users nothing about whether they're on track for the period they selected. There's also no visual cue for category-level anomalies — a month at +2σ over rolling history is invisible unless the user spots the bar manually.

## Architecture

- **Forecast tail on Net Cashflow chart** — extend the existing chart with a dashed line projecting from "today" to the end of the selected period. Algorithm: **seasonal-naive baseline** — for the remaining months, predict each month as `mean(samePosition prior years) + recurringTotal(month)`. Falls back to current-pace linear when insufficient history (< 12 months).
- **Anomaly bands per category** — on the `ExpenseCategoryChart` and on the Expense Summary monthly table, render mean ± 1.5σ over rolling 6 months as a faint band; flag the month rows that fall outside.
- **Optional calendar heatmap** — small heatmap component on Expense Summary showing daily spend intensity over the selected period (defer if time-constrained).
- Forecasting is **pure computation** over existing data. No new tables.
- All three additions consume Phase 6 `RecurringSeries` data for accurate baselines (recurring amounts are known with high confidence; non-recurring uses rolling mean).

## Scope

- `forecastNetCashflow(userId, period) → ForecastPoint[]` service.
- Forecast tail rendering on `NetCashflowChart` (dashed line, distinct colour, legend entry).
- `detectMonthlyAnomalies(seriesByCategory) → AnomalyFlag[]` service.
- Anomaly band rendering on `ExpenseCategoryChart` (faint shaded region).
- Anomaly flag column on `MonthlyExpenseTable` (Phase 3 component).
- Calendar heatmap component on Expense Summary (small, GitHub-style).

## Out of Scope

- ML / ARIMA / Prophet forecasting — explicitly defer in favour of seasonal-naive + recurring.
- User-configurable forecasting parameters.
- Forecasting income separately (low value — income is largely from known recurring sources).
- Anomaly detection for income.
- Push notifications when anomalies cross a threshold.
