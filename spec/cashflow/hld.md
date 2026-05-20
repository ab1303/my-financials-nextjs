# Cashflow Domain — High Level Design

## Problem Statement
The cashflow domain is a derived reporting and audit layer over the app's operational money records. It does not own canonical income, expense, transaction, or asset data; instead, it assembles those sources into route-level summaries, quality checks, and audit findings that keep the cashflow experience trustworthy.

## Shared Domain Views

### `CashflowPeriod`
A derived time window used by cashflow pages and audits.

- Supports fiscal-year and month-level analysis.
- Must align with `CalendarYear` records and URL-driven page state.
- Provides the time boundary for cashflow totals, page filters, and audit evidence.

### `CashflowSnapshot`
A read model composed from downstream domains.

- Aggregates income and expense rollups from the [income-expense domain](../income-expense/hld.md).
- Uses transaction evidence and import lineage from the [transactions domain](../transactions/hld.md).
- Uses balance and net-worth context from the [assets domain](../assets/hld.md).
- Feeds summary pages, audits, and remediation work, but never becomes the source of truth.

### `CashflowAuditFinding`
A structured audit artifact for cashflow pages.

- Identifies the affected route, component, or shared UI primitive.
- Carries issue class (`CRUD`, `SSR`, `dark-mode`, `accessibility`, `metadata`).
- Stores severity, evidence, and remediation target.
- Can reference both verified fixes and unresolved follow-up items.

## Architecture Decisions

1. **Cashflow is a reporting layer, not a ledger.**
   All cashflow audits and summaries derive from domain-owned records elsewhere in the spec tree.

2. **Audits are route-scoped and evidence-backed.**
   Findings must reference the exact page, interaction, or file touched, rather than vague domain-wide statements.

3. **Time scoping is multi-calendar.**
   Cashflow views can combine fiscal-year context, calendar-month rollups, and transaction date windows without redefining the underlying calendar models.

4. **Fixes live in downstream domains.**
   A cashflow audit can recommend changes in income, donations, expense, bank-interest, or shared UI code, but the audit domain only records evidence and ownership.

5. **Validation mixes user-observable behavior with code review.**
   Playwright/manual verification and file-level inspection are both valid evidence sources for cashflow findings.

## Cross-Domain References

- **income-expense** — income tables, monthly expense summaries, interest-cleansing totals, and fiscal-year rollups.
- **transactions** — imported cash evidence, SSR/client-boundary issues caused by filter state, and downstream enrichment references.
- **assets** — account and balance context used when assessing whether cashflow screens align with broader financial overview features.
- **banking** — bank-account availability and bank-interest workflows that influence what the cashflow UI can display or validate.

## Out of Scope

- Owning canonical transaction, income, expense, or asset schemas.
- Implementing remediation work tracked by an audit finding.
- Tax advice, investment advice, or payment execution.
