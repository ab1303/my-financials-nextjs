# Cashflow Analytics Dashboard — Context

## Problem

Users need to visualize financial trends, categorize spending, and understand their overall financial health, as aggregate reporting is superior to raw ledger views for pattern recognition.

## Architecture
- **API**: `GET /api/cashflow/analytics` REST handler.
- **Service Layer**: Aggregates data from `income.service.ts` and `expense.service.ts`.
- **UI**: Server Component + Client Wrapper (`CashflowAnalyticsClient.tsx`) utilizing `shadcn/ui` charts.

## Scope
- Income vs. Expenses trend (grouped bar chart).
- Net cashflow trend (bar chart).
- Expense breakdown (horizontal bar chart).
- KPI summary (Income, Expenses, Net, Savings Rate).
- Drill-down navigation to transactions.
