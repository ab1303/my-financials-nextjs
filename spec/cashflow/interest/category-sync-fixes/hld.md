# Category Sync Fixes: Interest Cleansing + Referential Integrity — HLD

## Problem
After renaming the "Bank Interest" expense category to "Interest Cleansing", two bugs emerged:
- The linking workflow broke because the service function still searched for the old category name.
- Renaming a category in admin settings orphaned all related transactions, as `Transaction.category` is a plain string, not a foreign key.

## Solution
- When an expense category is renamed, update all `Transaction` records with the old category name to the new one.
- Refactor the service function to use a configurable category name (not hardcoded).
- Do not change the schema: `Transaction.category` remains a string for historical reasons.
- Ensure all references (transactions, summaries, etc.) are updated consistently.
- No breaking changes to the data model; maintain auditability and historical integrity.

## Architecture Decisions
| Decision | Rationale |
|---|---|
| Update transactions on category rename | Ensures referential integrity without schema migration |
| Use config/constant for category in service | Prevents future breakage if category name changes again |
| No FK on Transaction.category | Preserves historical data and avoids migration risk |
| Bulk update via service utility | Efficient and testable; centralizes logic |
| Audit trail via consistent updates | Maintains data integrity across all references |

## Data Model Review
- `ExpenseCategory`: Managed via CRUD, unique name, referenced by summaries.
- `Transaction`: Category is a string, not a FK; must be updated on rename.
- `MonthlyExpenseSummary`: Uses FK to `ExpenseCategory` (not affected).

## Component Changes
- Service: Update `getUnlinkedCleansingDebitTransactions` to use a configurable category name.
- tRPC Router: Add logic to update transactions on category rename.
- Service Utility: Add function to bulk update transaction categories.

## Success Criteria
- Renaming a category updates all related transactions.
- Linking workflow works regardless of category name changes.
- No orphaned transactions after rename.
- No schema changes required.

## Out of Scope
- Migrating `Transaction.category` to a foreign key.
- Changes to `MonthlyExpenseSummary` or other unrelated models.
- UI changes beyond fixing the linking workflow.
