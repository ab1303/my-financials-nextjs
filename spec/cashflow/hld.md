# Cashflow Domain — High Level Design

## Overview
The cashflow domain is the unified specification surface for financial-flow management across income, expense, donations, interest cleansing, and audit work. It groups the product's money-in, money-out, and flow-quality concerns under one domain while still respecting the underlying sources of truth: dedicated CRUD models for income and expense, donation and zakat ledgers for charitable outflows, ledger-backed transaction evidence for interest and donation linking, and audit artifacts for route reliability.

## Shared Domain Concepts

### `CashflowPeriod`
A reusable time window for cashflow features.

- Supports monthly, annual, fiscal-year, Zakat-year, and other calendar-backed views.
- Must align with `CalendarYear` state and route-level filter parameters.
- Allows one feature to show monthly detail while another rolls up to fiscal-year, annual, or Zakat-year totals.

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

### `DonationRecord`
A fiscal-year charitable-outflow aggregate.

- Represents voluntary giving and related charitable adjustments such as interest cleansing.
- Is implemented as `DonationLedger` plus `DonationPayment` rows.
- Uses fiscal-year scoping, beneficiary metadata, tax categorization, and optional transaction attribution.

### `CharitablePaymentRecord`
A shared row-level contract for charitable cash outflows.

- Common fields include `datePaid`, `amount`, `beneficiaryType`, beneficiary reference, parent year/obligation reference, and optional transaction attribution when the payment is derived from imported bank activity.
- `DonationPayment` adds `taxCategory`, `donationPurpose`, and an optional `transactionId`.
- `ZakatPayment` keeps the same beneficiary and amount structure while remaining tied to a `ZakatObligation`.

### `ZakatObligation`
An annual obligatory-giving aggregate.

- Represents the amount due for a selected Zakat year.
- Is implemented as `ZakatObligation` plus `ZakatPayment` rows.
- Uses `CalendarYear` records of type `ZAKAT` rather than fiscal-year donation calendars.

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

- Aggregates income, expense, donation, zakat, and interest signals into dashboard and review surfaces.
- Supports trust-building summaries such as totals, balances, and uncategorized follow-up counts.
- Never replaces the underlying ledgers or CRUD models as the source of truth.

### `CashflowAuditFinding`
A structured quality record for cashflow routes.

- Names the affected route, interaction, or UI primitive.
- Tracks issue class, evidence, severity, and remediation ownership.
- Preserves both verified fixes and unresolved follow-up work.

## Donations (Outflows)

- **Donations** are voluntary transaction-based charitable outflows recorded within fiscal-year cashflow reporting.
- **Zakat** is obligatory wealth-based Islamic giving tracked alongside donations because it is also a beneficiary-aware cash outflow.
- **Transaction linking** reconciles donation rows with imported transaction records without changing the transaction ledger as the source of truth.
- Donations behave like expenses in retained-cash summaries, but they keep distinct charitable metadata, beneficiary relationships, and yearly reporting rules.

## Architecture Decisions

1. **Cashflow is one financial-flow domain with five grouped feature areas.**
   Income, expense, donations, interest, and audit specs share language, time models, and flow relationships even when their implementation details differ.

2. **Each flow keeps its strongest source of truth.**
   Income and expense remain app-managed CRUD records, voluntary donations and Zakat payments remain charitable ledgers, interest received is derived from the transaction ledger, and audits remain evidence records rather than product data.

3. **Charitable outflows share a header + payment-row pattern.**
   Donations and Zakat both use a year-scoped header record with many payment rows so totals, beneficiaries, and yearly obligations remain consistent across the subgroup.

4. **Transaction linking is enrichment, not source mutation.**
   Imported `Transaction` rows remain the immutable cash evidence; charitable pages attach metadata through optional one-to-one links.

5. **Time scoping is first-class and multi-calendar.**
   Fiscal-year planning, donation review, Zakat-year obligations, annual bank-interest reporting, monthly tables, and other calendar contexts can coexist without redefining the underlying models in each feature spec.

6. **User scoping is enforced through session context and owned relations.**
   Beneficiaries, linked transactions, and charitable pages are filtered through the authenticated user, even when header tables themselves do not carry a direct `userId`.

7. **Audit work is flow-aware but non-owning.**
   Audits can inspect income, expense, donation, and bank-interest routes together because they belong to the same cashflow surface, but remediation still lands in the downstream feature that owns the behavior.

8. **Server-first delivery remains the default across the domain.**
   Data loading, aggregation, and mutations happen server-side; client wrappers are reserved for interactive tables, drawers, filters, and inline editing.

## Time Contexts

### Fiscal-Year Context
- Primary planning and reporting window for income, expense, and voluntary donation management.
- Drives yearly totals, filters, and net-flow summaries.

### Monthly Context
- Required for expense breakdowns, monthly cashflow views, and interest-credit attribution.
- Allows users to reconcile discrete inflows or outflows against calendar periods.

### Annual / Calendar-Year Context
- Used for bank-interest receipt and annual donation review when imported transactions are reconciled.
- Aligns with imported transaction dates and donation ledgers.

### Zakat-Year Context
- Used for obligatory-giving tracking through `CalendarYear` records of type `ZAKAT`.
- Keeps `amountDue` and payment progress separate from fiscal-year donation ledgers.

### Multi-Calendar Support
- Cashflow features must tolerate multiple `CalendarEnumType` modes where relevant.
- The same domain may show fiscal-year reporting for income, expense, and donations; annual reporting for interest; and Zakat-year reporting for obligations without duplicating model definitions.

## Cross-Feature Relationships

- Income and expense together define the user's everyday cash position.
- Voluntary donations and Zakat payments are cash outflows like expenses, but they retain beneficiary-aware charitable semantics.
- Transaction-linked donations preserve reconciliation between cash-outflow summaries and imported bank evidence.
- Interest received is still a cash inflow, but it must remain distinguishable from ordinary income because it carries a cleansing obligation.
- Interest-cleansing donations reduce retained cashflow and should remain auditable against the original interest received.
- Audit features validate that all cashflow routes remain trustworthy across CRUD behavior, SSR boundaries, dark mode, accessibility, metadata, and time-filter interactions.

## Out of Scope

- Replacing the transaction, banking, calendar, or assets domains as canonical data owners.
- Defining portfolio, net-worth, or tax strategy rules outside the cashflow surface.
- Providing religious, legal, or tax advice on behalf of the user.
- Executing audits, donations, or bank actions on behalf of the user.