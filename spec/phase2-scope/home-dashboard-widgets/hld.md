# Home Dashboard Widgets — High-Level Design (HLD)

## Problem & Solution
The current home page lacks live financial data, providing only navigation and static quick actions. Users have no immediate awareness of their financial status upon login. To address this, we will introduce a set of dashboard widgets that surface key financial snapshots: net worth, account balances, cashflow pulse, and recent transactions. These widgets provide a real-time status panel, complementing (not duplicating) analytics and net worth trend pages.

## Architecture Decisions
1. **Server Components for Data Fetching**: All widgets are Server Components, fetching data directly from services for performance and security.
2. **No tRPC or API Calls in Widgets**: Data is fetched via direct service imports, matching the existing home page pattern for consistency and simplicity.
3. **Widget Layout Above Navigation**: Widgets are rendered above the existing quick action cards, ensuring immediate visibility.
4. **Suspense for Async Loading**: Each widget is wrapped in `<Suspense>`, allowing independent loading and skeleton states.
5. **No Schema Changes**: All required data exists; no Prisma migrations or model changes are needed.

## Data Flow Diagram

```
[Home/Page.tsx (Server Component)]
   |
   |---> [NetWorthWidget] --+--> [getNetWorthTrend] --+--> [DB]
   |---> [AssetBalanceCards] |                         |
   |---> [CashflowPulseCard] +--> [getCalendarYears] --+
   |---> [RecentTransactionsWidget]---> [Prisma] ------+
```

## No Schema Changes
All data required for widgets is present in existing models. No migrations or DB changes are needed.

## Component Tree

```
HomePage (Server)
├─ Suspense(NetWorthWidget)
├─ Suspense(AssetBalanceCards)
├─ Suspense(CashflowPulseCard)
├─ Suspense(RecentTransactionsWidget)
├─ QuickActionCards
├─ RecentActivityCard
├─ QuickNavigationCard
├─ AIUsageDashboardCard (x3)
```

## Success Criteria
- Home page displays live net worth, account balances, cashflow pulse, and recent transactions above navigation cards
- Widgets load independently with skeletons
- Empty states are handled gracefully (no data, no transactions)
- No duplicate analytics/net worth charts
- No new API routes except dashboard summary
- No schema changes or migrations

## Out of Scope (Phase 2)
| Feature                              | Reason/Notes                        |
|--------------------------------------|-------------------------------------|
| Month-over-month delta on balances   | Enhancement, not MVP                |
| Daily spending pace line chart       | Requires budget target model        |
| Upcoming bills widget                | Needs recurring transaction logic   |
| Savings goals progress bars          | No goals model yet                  |
| Empty state onboarding wizard        | Future onboarding work              |
| Donation/Zakat summary widget        | Not in current scope                |