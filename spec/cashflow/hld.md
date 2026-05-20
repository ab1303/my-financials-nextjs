# Cashflow Domain — High Level Design

## Overview
The cashflow domain is the unified specification surface for financial-flow management across income, expense, interest cleansing, and audit work. It groups the product's money-in, money-out, and flow-quality concerns under one domain while still respecting the underlying sources of truth: dedicated CRUD models for income and expense, ledger-backed transaction evidence for interest, donation records for cleansing, and audit artifacts for route reliability.

## Shared Domain Concepts

### `CashflowPeriod`
A reusable time window for cashflow features.

- Supports monthly, annual, fiscal-year, and other calendar-backed views.
- Must align with `CalendarYear` state and route-level filter parameters.
- Allows one feature to show monthly detail while another rolls up to fiscal-year or annual totals.

### `IncomeRecord`
A user-owned inflow entry managed directly by the app.

- Captures source, amount, date, category, and notes.
- Participates in fiscal-year summaries and net-cash calculations.
- Can be enhanced by richer filtering, grouping, and editing UX without changing the base record shape.

### `ExpenseEntry`
A user-owned outflow entry managed directly by the app.

- Captures amount, category, date, and notes.
- Feeds monthly and fiscal-year expense analysis.
- Combines with income totals to produce net cashflow views.

### `InterestCredit`
A derived inflow representing interest received from bank activity.

- Sourced from confirmed `Transaction` records categorized as bank interest.
- Scoped by bank, month, and calendar year.
- Can be supplemented by manual monthly overrides when statement imports are incomplete.

### `InterestCleansingDonation`
A donation record that removes interest from the user's retained cash position.

- Reuses `DonationPayment` with an interest-cleansing discriminator instead of a bespoke payment model.
- May be linked to a ledger transaction or recorded manually.
- Belongs to a yearly obligation pool even when interest is received month by month.

### `CashflowSnapshot`
A read model composed from the domain's financial flows.

- Aggregates income, expense, and interest signals into dashboard and review surfaces.
- Supports trust-building summaries such as totals, balances, and uncategorized follow-up counts.
- Never replaces the underlying ledgers or CRUD models as the source of truth.

### `CashflowAuditFinding`
A structured quality record for cashflow routes.

- Names the affected route, interaction, or UI primitive.
- Tracks issue class, evidence, severity, and remediation ownership.
- Preserves both verified fixes and unresolved follow-up work.

## Architecture Decisions

1. **Cashflow is one financial-flow domain with four grouped feature areas.**
   Income, expense, interest, and audit specs share language, time models, and flow relationships even when their implementation details differ.

2. **Each flow keeps its strongest source of truth.**
   Income and expense remain app-managed CRUD records, interest received is derived from the transaction ledger, cleansing payments are stored as donations, and audits remain evidence records rather than product data.

3. **Time scoping is first-class and multi-calendar.**
   Fiscal-year planning, annual bank-interest reporting, monthly tables, and other calendar contexts can coexist without redefining the underlying models in each feature spec.

4. **Interest is ledger-first with manual escape hatches.**
   Imported transactions should drive interest received whenever possible, while monthly overrides and manual cleansing entries remain available for incomplete statement coverage and cash donations.

5. **Audit work is flow-aware but non-owning.**
   Audits can inspect income, expense, and bank-interest routes together because they belong to the same cashflow surface, but remediation still lands in the downstream feature that owns the behavior.

6. **Server-first delivery remains the default across the domain.**
   Data loading, aggregation, and mutations happen server-side; client wrappers are reserved for interactive tables, drawers, filters, and inline editing.

## Time Contexts

### Fiscal-Year Context
- Primary planning and reporting window for income and expense management.
- Drives yearly totals, filters, and net-flow summaries.

### Monthly Context
- Required for expense breakdowns, monthly cashflow views, and interest-credit attribution.
- Allows users to reconcile discrete inflows or outflows against calendar periods.

### Annual / Calendar-Year Context
- Used for bank-interest receipt and cleansing obligations.
- Aligns with imported transaction dates and donation ledgers.

### Multi-Calendar Support
- Cashflow features must tolerate multiple `CalendarEnumType` modes where relevant.
- The same domain may show fiscal-year reporting for income/expense and annual reporting for interest without duplicating model definitions.

## Cross-Feature Relationships

- Income and expense together define the user's everyday cash position.
- Interest received is still a cash inflow, but it must remain distinguishable from ordinary income because it carries a cleansing obligation.
- Interest-cleansing donations reduce retained cashflow and should remain auditable against the original interest received.
- Audit features validate that all cashflow routes remain trustworthy across CRUD behavior, SSR boundaries, dark mode, accessibility, metadata, and time-filter interactions.

## Out of Scope

- Replacing the transaction, donation, banking, or calendar domains as canonical data owners.
- Defining portfolio, net-worth, or tax strategy rules outside the cashflow surface.
- Executing audits, donations, or bank actions on behalf of the user.