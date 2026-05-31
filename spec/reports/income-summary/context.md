# Income Summary Report — Context

## Problem Summary
Users need a clear, year-based summary of their income, broken down by month and source, for tax reporting and personal review. The income summary report provides a tabular view of all confirmed income, grouped by fiscal year, to support these needs.

## Domain Dependencies
- **cashflow/income**: Relies on `Transaction` records with `type = 'CREDIT'` and `status = 'CONFIRMED'`.
- **settings/calendar-management**: Uses `CalendarYear` and user fiscal year preferences.

## In Scope
- Fiscal year selector (AppSelect)
- KPI cards: Total Income, Average Monthly Income, Months Recorded
- Monthly summary table with per-source breakdown
- REST API for monthly summary data
- Auth guard (NextAuth v5)

## Out of Scope
- Expense, donation, or Zakat reports
- Export to CSV/PDF
- Year-over-year or visual/chart-based comparisons

## Existing Patterns to Reuse
- Server Component for auth and data fetching
- Client Component for interactivity (year selection, table rendering)
- REST API route for report data
- Toast notifications for errors (`sonner`)

## Known Constraints
- ⚠️ **Security**: Current implementation passes `userId` as a query param to the API route, allowing authenticated users to query other users' data. The API should derive `userId` from the session.
- No empty state message when no data for selected year
- No toast notification on fetch error
