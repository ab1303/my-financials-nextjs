# Cashflow Analytics Dashboard — Context

## Problem

Users have income and expense data in the app but no way to visualise trends, compare periods, or understand their financial health at a glance. The existing Income Summary page (`/reports/income-summary`) shows a table with basic stats — useful for drill-down but not for pattern recognition.

Users need to:
1. See **income vs expenses as a trend** over their fiscal or calendar year
2. Understand **where money is going** (expense category breakdown)
3. Know their **savings rate** and net cashflow at a glance
4. **Slice and dice** by period and bank account without leaving the page
5. **Drill down** from a chart into the underlying transactions for verification

Top personal finance apps (Monarch Money, Copilot, YNAB, Empower) all lead with a cashflow trend dashboard as the primary analytical surface. This spec introduces an equivalent experience for this app.

## Domain Dependencies

- Uses `CashflowPeriod`, `CategoryTaxonomy`, `CashflowSnapshot` from [`../../hld.md`](../../hld.md)
- **Income data**: `Transaction(type=CREDIT, status=CONFIRMED)` — already served by `getMonthlyIncomeSummary` and `getTotalIncome` in `income.service.ts`
- **Expense data**: `Transaction(type=DEBIT, status=CONFIRMED)` — already served by `getMonthlyExpenseSummaries` and `getTotalExpenses` in `expense.service.ts`; category breakdown via `CategoryBreakdown` type in `expense.ts` model
- **Bank account filter**: User's `FinancialAccount` records — already used by income and expense services
- **Time scoping**: `CalendarYear` with fiscal/annual toggle — already established in income-management and expense-tracking features
- **Drill-down navigation**: Navigates to `/cashflow/transactions` with pre-set URL filters (aligns with `../../categories/drill-down` spec)
- **Home dashboard**: Existing `/home` page gains real KPI numbers (income, expenses, net) sourced from this feature's data layer

## Scope

**In scope:**
- New route `/cashflow/analytics` with a full cashflow analytics view
- 4 KPI summary cards: Total Income, Total Expenses, Net Cashflow, Savings Rate
- Income vs Expenses grouped bar chart (12 months across selected period)
- Net Cashflow per-month bar chart (single series, positive/negative coloring)
- Expense breakdown by category (horizontal bar chart with amount + percentage)
- Income breakdown by source (horizontal bar or donut chart)
- Period picker: fiscal year / annual year (matching existing `CalendarYearPicker` pattern)
- Bank account filter (user's `FinancialAccount` records; manual entries always shown)
- Click-through from category/source chart item → `/cashflow/transactions` filtered by that category and month/year
- Click-through from a monthly bar → `/cashflow/expense` or `/cashflow/income` filtered to that month
- Skeleton loading states for all chart and KPI sections
- Enhancement to home dashboard (`/home`): add real KPI numbers (replacing placeholder "View Income" cards)
- shadcn/ui chart component installation and shared chart wrapper

**Out of scope:**
- Budget vs actual tracking (requires budget features not yet built)
- Multi-year comparison (comparing FY2024 vs FY2025 side-by-side)
- Donation or zakat visualisations in this slice (separate charitable outflows)
- Net worth or asset trends (assets domain)
- Export to PDF/CSV from the analytics page
- Real-time streaming updates
- AI-powered insights or anomaly detection
- Custom date range picker (period is bounded to existing `CalendarYear` records)

## Known Constraints

- Income `getMonthlyIncomeSummary` does NOT yet support `bankAccountId` filter — must be added or proxied
- No year-level expense category breakdown service exists — must add `getExpenseCategoryBreakdownForYear` 
- No year-level income source breakdown service exists — must add `getIncomeSourceBreakdownForYear`
- No combined analytics endpoint exists — introduce `/api/cashflow/analytics` REST handler
- shadcn chart component (built on Recharts) must be added via `pnpm dlx shadcn@latest add chart` before implementing chart components — Recharts 3.x is already installed
- The `/cashflow/analytics` route must NOT appear in the sidebar until this feature is shipped; add to nav as part of this spec
