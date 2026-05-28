# Expense Tracking — Context

## Problem
Users need clear expense capture and analysis so they can understand where cash is leaving the business or household and reconcile that against income over time.

## Domain Dependencies

- Uses `CashflowPeriod`, `ExpenseCategory`, and `CashflowSnapshot` from [`../../hld.md`](../../hld.md).
- **All expense data lives in the `Transaction` table** with `type=DEBIT` and `status=CONFIRMED`.
- Manual expenses are created as `Transaction(type=DEBIT, source=USER_MANUAL)` — see `../manual-expense-transaction/context.md`.
- `ExpenseLedger` and `MonthlyExpenseSummary` are **deprecated** — expense views query Transaction live.
- Bank account filtering: when active, filters by `Transaction.bankAccountId` using user's `FinancialAccount` records.
- Shares net-flow reporting with income management.
- Can be inspected by audit work because the expense route is part of the broader cashflow surface.

## Scope

**In scope:**
- Querying expenses from the `Transaction` ledger (type=DEBIT, status=CONFIRMED).
- Creating manual expense entries as `Transaction(type=DEBIT, source=USER_MANUAL)` records.
- Editing and deleting only USER_MANUAL expense entries; imported expenses are read-only.
- Category and time-based (month + fiscal-year **and annual-year**) expense analysis.
- Bank account filter using user's FinancialAccount records.
- Monthly and fiscal-year views that contribute to net cashflow reporting.

**Out of scope:**
- Income-specific CRUD or UX work.
- Interest-cleansing workflows.
- Site-wide audit activity outside the cashflow area.
- Removing deprecated tables from schema (separate migration task).