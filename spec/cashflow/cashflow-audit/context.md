# Cashflow Audit — Context

## Problem
The cashflow area contains high-frequency data-entry and review pages. Those pages must remain reliable across CRUD workflows, server rendering, dark mode, metadata, and accessibility. The legacy flat audit report captured those findings as a one-off artifact; this feature turns that report into a scoped cashflow-domain spec.

## Domain Dependencies

- Uses the `CashflowAuditFinding` and `CashflowSnapshot` concepts from the [cashflow domain HLD](../hld.md).
- References route behavior owned by the income, donations, expense, and bank-interest features.
- Relies on fiscal-year and month-scoped filters that are ultimately backed by calendar and transaction-domain state.

## Scope

**In scope:**
- Auditing `/cashflow/income`, `/cashflow/donations`, `/cashflow/expense`, and `/cashflow/bank-interest`.
- Recording verified findings, fixes, and remaining follow-up work.
- Tracking dark-mode, accessibility, SSR, metadata, and CRUD behavior that affects cashflow trustworthiness.

**Out of scope:**
- Implementing new product features.
- Replacing downstream feature specs.
- Broad site-wide audit work outside the cashflow surface.
