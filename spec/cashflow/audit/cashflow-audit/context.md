# Cashflow Audit — Context

## Problem
The cashflow area contains high-frequency data-entry and review pages. Those pages must remain reliable across CRUD workflows, server rendering, dark mode, metadata, and accessibility. This feature captures that quality work as a scoped audit spec inside the unified cashflow domain.

## Domain Dependencies

- Uses `CashflowAuditFinding` and `CashflowSnapshot` from [`../../hld.md`](../../hld.md).
- References route behavior owned by the income, expense, interest, and donation surfaces that make up the broader cashflow experience.
- Relies on fiscal-year, annual, and month-scoped filters that are ultimately backed by calendar and transaction-domain state.

## Scope

**In scope:**
- Auditing `/cashflow/income`, `/cashflow/donations`, `/cashflow/expense`, and `/cashflow/bank-interest`.
- Recording verified findings, fixes, and remaining follow-up work.
- Tracking dark-mode, accessibility, SSR, metadata, and CRUD behavior that affects cashflow trustworthiness.

**Out of scope:**
- Implementing new product features.
- Replacing downstream feature specs.
- Broad site-wide audit work outside the cashflow surface.