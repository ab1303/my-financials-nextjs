# Category Drill-Down — Context

## Problem
Expense summary aggregates lack discoverability, preventing users from quickly verifying totals or reviewing transactions.

## Architecture
- **Navigation**: Deep links from summary widgets directly to the transaction ledger.
- **Filtering**: URL-driven filters (`categoryName`, `month`, `year`) persist state.
- **Service Layer**: tRPC procedure fetches transactions based on period + category scope.

## Scope
- Category-aware deep links.
- Filtered ledger view preservation.
- Summary metadata display.
