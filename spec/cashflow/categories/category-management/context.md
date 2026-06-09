# Category Management — Context

## Problem
Taxonomy management was previously split across inconsistent patterns, with some categories enum-backed (requiring deployments) and others database-backed but lacking UI. Users need a unified management surface.

## Architecture
- **Persistence**: Managed lookup tables (`IncomeSource`, `ExpenseCategory`).
- **Management UI**: Settings panel at `/settings/categories`.
- **Integration**: All cashflow features resolve category strings at the service/import boundary.

## Scope
- CRUD for managed category vocabularies.
- Soft-delete semantics (`isActive`).
- Updating forms/filters to consume database-backed lookup records.
