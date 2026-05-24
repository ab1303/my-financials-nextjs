# Manual Expense Entry via Transaction Record

## Problem Statement

After the regression fix (expense totals now read from the Transaction table, not `MonthlyExpenseSummary`), the "Add New Expense" form in `CategoryBreakdownModal` was disabled. Currently, users cannot manually add an expense from the Expenses page — they must go to the Transaction Ledger and create a DEBIT transaction there.

This feature restores the "Add New Expense" UX by making the form create a real `Transaction` record (type=DEBIT, status=CONFIRMED, source=USER_MANUAL) instead of writing to the deprecated `MonthlyExpenseSummary` table. The new transaction appears in both the Expenses page AND the Transaction Ledger, maintaining the single source of truth.

## Domain Dependencies

- See `spec/cashflow/hld.md` for the Transaction data model, DEBIT/CREDIT/CONFIRMED/VOIDED status lifecycle, and the fiscal year date-range pattern.
- The Transaction table is the single source of truth for all financial data. The `MonthlyExpenseSummary` table remains as a shadow/historical table but is no longer authoritative for expense display.

## Scope

**In scope:**
- "Add New Expense" form creates a `Transaction` record with `type=DEBIT`, `status=CONFIRMED`, `source=USER_MANUAL`, `category=<selectedCategoryName>`, `date=<first day of selected month>`, `amount=<entered amount>`
- "Edit Expense" updates an existing `source=USER_MANUAL` Transaction record (amount + category only)
- "Delete Expense" voids the Transaction record (`status=VOIDED`) — not a hard delete, consistent with audit trail requirements
- Re-enable Add/Edit/Delete buttons in `CategoryBreakdownModal` for USER_MANUAL transactions only; bank-imported transactions remain read-only (or have a separate edit flow)
- `getExpenseEntriesForMonth` returns a `source` field so the UI can distinguish USER_MANUAL from bank-imported entries

**Out of scope:**
- Bulk manual entry
- Changing the date of a manual transaction to a different month
- Modifying bank-imported transactions via the Expenses modal (separate feature)
- Removing `MonthlyExpenseSummary` table (schema migration risk; leave for a dedicated cleanup)
