# Context — Remove denormalized `MonthlyExpenseSummary`

## Problem statement

`MonthlyExpenseSummary` is a denormalized table updated by CSV import, transfer-linking jobs, and a few server-side operations. Over time this has produced rollup drift where aggregated totals diverge from the authoritative `transaction` table. Several code paths both read and write the table, creating maintenance burden and risk of inconsistent reports.

## Why now

- Recent bug investigations showed missing CSV rows caused primarily by dedup logic; rollups add complexity to debugging.
- The UI/analytics code already relies on `transaction` as the primary source-of-truth; migrating will align systems and simplify reasoning.

## Stakeholders

- Product (analytics correctness)
- Engineering (maintainability)
- QA (regression validation)
- Support (ability to investigate historical reports during migration window)

## Scope

In scope:

- Stop application code from updating `MonthlyExpenseSummary` as part of normal flows (CSV-confirm, transfer linking, reimbursements) and instead rely on `transaction`-derived aggregates.
- Replace direct reads in server APIs/controllers used by UI with computed aggregations (via `transaction` queries or a DB view).
- Provide a migration and backfill process to rebuild summaries for historical archive or reporting needs.

Out of scope:

- Changing external reporting systems that already consume a dump of `MonthlyExpenseSummary` (they will be handled by a cutover plan and/or by providing a temporary view).
