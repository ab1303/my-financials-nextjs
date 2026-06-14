# Low-Level Design — Remove/Realign `MonthlyExpenseSummary`

## Overview

This LLD specifies the concrete implementation steps, file-by-file changes, DB migration plan, test strategy, and rollback procedures to remove or realign `MonthlyExpenseSummary`.

### Key decisions

- Preserve `transaction` as the canonical source of truth for all expense totals and category aggregates.
- Avoid data-loss: provide a backfill script that rebuilds `MonthlyExpenseSummary` from `transaction` for audit/compatibility during the deprecation window.
- Use feature-flagged rollout: disable writes to `MonthlyExpenseSummary` behind a server-side flag before removing schema.

## File inventory (current known consumers)

- Reads:
  - `src/server/services/expense.service.ts` — `getExpenseEntries`, `getExpenseEntriesForMonth`, `getMonthlyExpenseSummaries`, `getExpenseCategoryBreakdownForYear` (some functions already derive from `transaction` but `getExpenseEntries` reads `monthlyExpenseSummary`).
  - `src/server/trpc/router/expense-category.ts` — includes `_count.monthlyExpenseSummaries` for usageCount.
  - Tests: `src/__tests__/unit/ledger.service.test.ts` and others reference rollup behavior.
- Writes:
  - `src/server/services/transactions/csv-confirm.service.ts` — `upsertMonthlyExpenseSummary()` invoked during CSV confirm.
  - `src/server/services/transactions/ledger.service.ts` & `transfer.service.ts` — `rerollupExpenseSummary()` used when linking/unlinking transfers.
  - Potential admin CRUD helpers in `src/server/services/expense.service.ts` (`addExpenseEntry`, `updateExpenseEntry`, `deleteExpenseEntry`) that create or modify `monthlyExpenseSummary`.

## Implementation plan (steps)

1. Inventory and tests
   - Run code search to collect all reads/writes (already partially completed). Add unit/integration tests that verify current numbers derived from `transaction` match `MonthlyExpenseSummary` for a representative DB snapshot.
2. Feature flag to disable writes
   - Add a server feature flag `disableMonthlyExpenseSummaryWrites` (env var `DISABLE_MONTHLY_EXPENSE_SUMMARY_WRITES` default=false).
   - Short-term change: make `upsertMonthlyExpenseSummary`, `rerollupExpenseSummary` and any direct `monthlyExpenseSummary.create/update` calls short-circuit when the flag is enabled (log actions). Ship this first.
3. Migrate read paths
   - Replace `getExpenseEntries` to compute month entries from `transaction` instead of reading `monthlyExpenseSummary` (keep compatibility layer: if `monthlyExpenseSummary` exists and a `USE_LEGACY_MONTHLY` flag is set, fallback to legacy behavior).
   - Replace usages of `_count.monthlyExpenseSummaries` (expense-category usageCount) with a derived count aggregated from `transaction` (query by category name).
4. Backfill/rebuild script
   - Add `scripts/rebuild-monthly-expense-summary.ts` which reads confirmed DEBIT transactions and writes a fresh set of `MonthlyExpenseSummary` rows into a staging schema/table or a backup file. The script is intended for one-time backfill before removal and for audit.
5. Run compatibility tests & parallel run
   - With writes disabled and reads migrated, run integration tests and compare UI outputs vs pre-change for a staging DB snapshot. Validate analytics, expense table, and category counts.
6. Schema removal migration
   - Once verified, create a Prisma migration that removes the `MonthlyExpenseSummary` model. Keep migration in a feature branch and coordinate deployment with a maintenance window.
7. Cleanup
   - Remove feature flags and legacy code paths. Remove backfill scripts or mark as archival.

## DB migration notes

- Back up DB before any migration. Export `MonthlyExpenseSummary` to a CSV or SQL dump.
- Prefer a two-step deploy:
  1. Deploy code that no longer writes to `MonthlyExpenseSummary` (flag-enabled).
  2. After verification, apply the Prisma migration to drop the table.

## Tests

- Unit tests: add tests to ensure `getMonthlyExpenseSummaries` and `getExpenseEntriesForMonth` return same aggregates (within tolerance) as the backfilled `MonthlyExpenseSummary` for a fixture dataset.
- Integration tests: run CSV import flows and confirm that no writes occur to `MonthlyExpenseSummary` when the flag is enabled, and that UI displays remain correct.

## Rollback plan

- If roll-forward fails, re-enable legacy code path by toggling `DISABLE_MONTHLY_EXPENSE_SUMMARY_WRITES=false` and revert the Prisma migration (apply reverse migration or restore DB backup).

## Acceptance & rollout checklist

1. Code changes landed behind `DISABLE_MONTHLY_EXPENSE_SUMMARY_WRITES` and deployed.
2. Backfill script executed and archived; pre/post reports produced.
3. Smoke tests show identical analytics results.
4. Prisma migration to drop `MonthlyExpenseSummary` is applied during scheduled window.
5. Post-deploy monitoring for 48 hours then remove compatibility flags and code.
