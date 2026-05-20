# Expense Tracking — Context

## Problem
Users need clear expense capture and analysis so they can understand where cash is leaving the business or household and reconcile that against income over time.

## Domain Dependencies

- Uses `CashflowPeriod`, `ExpenseEntry`, and `CashflowSnapshot` from [`../../hld.md`](../../hld.md).
- Shares net-flow reporting with income management.
- Can be inspected by audit work because the expense route is part of the broader cashflow surface.

## Scope

**In scope:**
- Recording, editing, deleting, and listing expense entries.
- Category and time-based expense analysis.
- Monthly and fiscal-year views that contribute to net cashflow reporting.

**Out of scope:**
- Income-specific CRUD or UX work.
- Interest-cleansing workflows.
- Site-wide audit activity outside the cashflow area.