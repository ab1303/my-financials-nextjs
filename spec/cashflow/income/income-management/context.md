# Income Management — Context

## Problem
Users need a reliable way to record, review, and maintain recurring and ad-hoc income so their cash position stays accurate across monthly and fiscal-year views.

## Domain Dependencies

- Uses `CashflowPeriod`, `IncomeRecord`, and `CashflowSnapshot` from [`../../hld.md`](../../hld.md).
- Shares reporting boundaries with expense tracking for net cashflow calculations.
- Must remain compatible with interest-cleansing and audit features that inspect the wider cashflow surface.

## Scope

**In scope:**
- Creating, editing, deleting, and listing income records.
- Fiscal-year and date-scoped filtering for income review.
- Income totals that can feed downstream cashflow summaries.

**Out of scope:**
- Advanced table ergonomics and batch workflows owned by the income UX feature.
- Expense or donation workflows.
- Bank-ledger-derived interest handling.