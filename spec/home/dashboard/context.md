# Dashboard Feature Context

## Problem Summary
The home page previously lacked a live, actionable financial overview. Users needed to visit multiple sections to understand their net worth, cashflow, and recent activity. The dashboard solves this by aggregating key metrics and trends into a single, server-rendered page immediately after login.

## Domain Dependencies
- Assets (bank, stock snapshots)
- Banking (transactions, balances)
- Cashflow (income, expenses, savings rate)
- Calendar years (fiscal/annual periods)
- AI usage logs (import cost tracking)

## In Scope
- Net worth, cash, and stock KPIs
- Fiscal year cashflow pulse
- Recent confirmed transactions
- Monthly income/expense trend
- Top expense categories
- AI usage cards (per import type)
- Quick action navigation cards

## Out of Scope
- Budget/actual tracking
- Upcoming bills/goals
- Zakat/donation summary
- Widget layout customization
- Push notifications

## Existing Patterns Reused
- Server Component data fetching
- Parallel Promise.all for performance
- Suspense for async widget streaming
- Calendar year anchor logic (fiscal > annual > first)
- Color-coded transaction types

## Known Constraints
- Always filter calendar years to ['FISCAL', 'ANNUAL']
- Widgets must handle empty/partial data (no snapshots, no calendar year)
- No widgets render for unauthenticated users
- AI usage cards are independent async RSCs
- No API route for dashboard summary; data fetched directly in page
