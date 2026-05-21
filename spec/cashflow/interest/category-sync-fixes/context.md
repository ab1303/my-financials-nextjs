# Category Sync Fixes: Interest Cleansing + Referential Integrity — Context

## Problem Summary
Renaming the "Bank Interest" expense category to "Interest Cleansing" broke the interest cleansing workflow and orphaned related transactions. This is due to hardcoded category names in service logic and the use of a plain string (not FK) for `Transaction.category`.

## Domain Dependencies
- Expense category CRUD (admin)
- Transaction service and linking logic
- tRPC router for expense categories
- Related spec: `spec/cashflow/interest/cleansing-debit-linking/`

## IN Scope
- Updating all transactions when a category is renamed
- Refactoring service logic to use a configurable category name
- Ensuring referential integrity for `Transaction.category`

## OUT of Scope
- Schema changes (no FK migration)
- UI redesigns or unrelated model changes

## Schema References
- `ExpenseCategory` (id, name)
- `Transaction` (category: string)
- `MonthlyExpenseSummary` (categoryId: FK)

## Patterns to Reuse
- Service utility for bulk updates
- tRPC mutation for admin actions

## Constraints
- No schema-breaking changes
- Must preserve transaction history
- Use pnpm for all scripts
