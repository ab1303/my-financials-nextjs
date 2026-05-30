# Home Dashboard Widgets — Context

## Problem Summary
The home page currently provides no live financial data, only navigation and static cards. Users lack immediate insight into their financial status. This feature adds dashboard widgets to surface net worth, account balances, cashflow pulse, and recent transactions for instant awareness.

## Domain Dependencies
- Asset Dashboard Service (net worth, balances)
- Bank/Stock Asset Services
- Income/Expense Services
- Calendar Year Service
- Transaction model (Prisma)

## Scope Boundary
**IN SCOPE:**
- Net worth hero widget (latest + sparkline)
- Bank and stock balance KPI cards
- Cashflow pulse (income, expenses, net, savings rate)
- Recent transactions feed (last 5, confirmed only)
- Widget layout and Suspense loading

**OUT OF SCOPE:**
- Trend/analytics charts (already on other pages)
- Month-over-month deltas
- Upcoming bills, savings goals, onboarding wizard
- Donation/Zakat summary
- Any schema or model changes

## Existing Patterns to Reuse
- Suspense + async Server Component pattern (see AIUsageDashboardCard)
- Direct service imports for data fetching
- Tailwind + Flowbite for styling

## Known Constraints & Gotchas
- `getNetWorthTrend` may return empty `dataPoints` if no snapshots exist; widgets must handle and display empty state gracefully
- Cashflow pulse uses fiscal year (CalendarYear), not calendar month
- Transaction query must filter `status = CONFIRMED` and exclude `category = 'Transfer'` to avoid noise
