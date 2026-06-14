# Remove denormalized `MonthlyExpenseSummary` table (High-Level Design)

## Goal

Remove or realign the legacy denormalized table `MonthlyExpenseSummary` so the application uses the `transaction` table as the single source of truth for expense totals and category aggregates. This reduces duplication, eliminates rollup drift, and simplifies maintenance.

## Motivation

- The codebase currently maintains per-month aggregated rows in `MonthlyExpenseSummary` that are updated during CSV import and certain transfer operations.
- Most UI flows (analytics, month breakdown) already derive totals from `transaction` (the source-of-truth). Maintaining a secondary table introduces complexity and risk of divergence, especially when transfer-link jobs mutate transaction categories.

## Non-goals

- Preserve `MonthlyExpenseSummary` as the primary source for reports. Instead, we will migrate behavior to derive from `transaction` or generate the table as a derived, rebuildable artifact only.

## High-level approach

1. Treat `MonthlyExpenseSummary` as a legacy, denormalized artifact.
2. Introduce a short migration plan to remove direct writes to `MonthlyExpenseSummary` and convert any usages that read it to compute from `transaction` (or fall back to a read-only, rebuildable view).
3. Provide a one-time data migration script to rebuild summaries from `transaction` for historical reporting if required.
4. Remove `MonthlyExpenseSummary` schema and code only after the application no longer writes or reads it directly (feature-flagged/coordination-ready).

## Risks & mitigations

- Risk: Reports or third-party integrations depend on `MonthlyExpenseSummary`. Mitigation: Inventory all consumers (APIs, controllers, tests) and add compatibility layers (views or deprecation window) before removal.
- Risk: Running DB migrations without backups. Mitigation: Require DB backup and a migration-run checklist; keep migration reversible where possible.

## Success criteria

- No runtime codebase references to `MonthlyExpenseSummary` (or remaining references are deliberate and documented) after completion.
- All analytics and expense UIs show identical numbers before and after migration (within known tolerances).
