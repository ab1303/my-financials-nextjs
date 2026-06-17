# Home Domain Architecture (Dashboard)

The home domain provides the main dashboard experience for authenticated users. It aggregates financial data from multiple domains—assets, banking, cashflow, and transactions—into a single, actionable overview. The dashboard is the user's entry point after login, surfacing key metrics, trends, and recent activity to enable quick assessment of financial health. All data is fetched server-side for performance and security, with interactive widgets rendered as Server Components.

## Architecture Decisions

1. **Server Components for Data Fetching**: All dashboard data is fetched in Server Components to maximize performance and prevent client-side data exposure.
2. **Two-Wave Parallel Data Fetch**: Data is loaded in two Promise.all waves—light, non-year-scoped data first, then year-scoped data after calendar year anchor is resolved. This reduces TTFB and enables streaming.
3. **Direct Service Calls, No API Route**: Data is fetched directly from service modules in the page component, not via an API route, to avoid unnecessary serialization and latency.
4. **Widget Isolation**: Each widget is a self-contained component, receiving only the data it needs. AI usage cards are independent async RSCs behind Suspense for granular streaming.
5. **Calendar Year Anchor Logic**: Fiscal year is preferred for all year-scoped calculations, falling back to annual or first available. This ensures consistency in cashflow and trend reporting.

## Data Flow Diagram

```
[Services]
  |-- getNetWorthTrend
  |-- getCalendarYears
  |-- getTotalIncome
  |-- getTotalExpenses
  |-- getMonthlyTrendForDateRange
  |-- getTopExpenseCategories
  |-- prisma.transaction.findMany
  |-- AIUsageLog (prisma)
      |
      v
[src/app/(authorized)/home/page.tsx]
      |
      v
[Widgets]
  |-- NetWorthWidget
  |-- AssetBalanceCards
  |-- CashflowPulseCard
  |-- RecentTransactionsWidget
  |-- MonthlyTrendWidget
  |-- TopExpensesWidget
  |-- AIUsageDashboardCard (x3)
  |-- Quick Action Cards
```

## Features in this Domain
- Dashboard (overview page)

## Success Criteria
- All widgets render for authenticated users with valid data
- Handles empty states (no snapshots, no transactions, no calendar year)
- Data loads in parallel, with fast TTFB
- No client-side data fetching for dashboard metrics
- AI usage cards stream independently

## Out of Scope
| Feature                        | Reason                                  |
|-------------------------------|------------------------------------------|
| Budget vs actual tracking      | Not implemented in dashboard             |
| Upcoming bills/savings goals   | Not part of dashboard scope              |
| Donation/Zakat summary         | Excluded from dashboard                  |
| Month-over-month deltas        | Not shown in current widgets             |
| User-configurable widget layout| Fixed layout only                        |
| Push notifications             | Not part of dashboard                    |