# Drill-Down — Context

## Problem
Category summaries expose aggregate totals without an easy path to inspect the transactions behind those numbers. Users need to verify category accuracy, review spending details, and continue working in the transaction ledger without losing context. This slice introduces category-aware deep links from summary views into a filtered transactions experience while keeping drill-down behavior consistent with the shared cashflow taxonomy used across income, expense, donations, and interest-cleansing reporting.

## Domain Dependencies
- Uses the taxonomy and URL-filtering patterns in `../../hld.md`
- Depends on the transactions domain for ledger rendering, transaction status/type semantics, and authenticated query scoping
- Depends on managed category vocabulary so expense drill-down stays aligned with the broader cashflow taxonomy even though this slice drills into expense transactions first

## Scope
**In scope:**
- Navigating from category totals to the transactions page with preset filters
- Persisting category/month/year filter state in the URL
- Server-side filtered transaction queries that mirror the source aggregate assumptions
- Resettable filtered transaction review on the existing transactions surface

**Out of scope:**
- Inline expansion inside the summary modal
- Bulk recategorization workflows from the drill-down screen
- Income or transfer drill-down variants
- Real-time recomputation of upstream monthly totals

## Known Constraints
- Expense drill-down must match only the transaction types and statuses represented in monthly expense totals.
- Filtered links should survive refresh and support bookmarking/shareable URLs.
- Date-range handling must align with the month/year semantics used by the source summary.
