# Batch Re-matching Expense Categories — Context

## Problem
Historical CSV imports categorized with legacy matching contain inaccurate category assignments, especially records defaulted to "Other". This feature provides controlled bulk re-matching using the newer embedding-based matcher to improve historical data quality.

## Domain Dependencies
- Uses semantic category matching logic referenced by [../hld.md](../hld.md).
- Uses CSV import lineage/session information to target rematch cohorts.
- Uses AI usage logging/cost tracking model from CSV import domain.

## Scope
**In scope**
- Filtered batch selection (category, import session, date range, threshold).
- Dry-run and commit execution modes.
- Job-level progress and summary reporting.
- Partial-failure-tolerant processing with audit-friendly results.

**Out of scope**
- Full user-facing dashboard workflows (admin/API-first initial scope).
- Automatic scheduled re-matching.
- ML retraining or model changes.
