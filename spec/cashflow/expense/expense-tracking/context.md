# Expense Tracking — Context

## Problem
Users need to visualize outflows, understand where money is going, and reconcile expenses against income over time.

## Architecture
- **Source of Truth**: `Transaction` table (`type=DEBIT`, `status=CONFIRMED`).
- **Reporting**: Monthly/fiscal-year breakdown.
- **Filtering**: Bank account parity, fiscal/annual year types.

## Scope
- Querying expenses from the `Transaction` ledger.
- CRUD for manual expense entries (`source=USER_MANUAL`).
- Category breakdown and drill-through navigation.
