# Donations Domain — High Level Design

## Problem Statement
The donations domain captures charitable giving workflows that sit between personal record-keeping and imported financial evidence. It must support manually entered donations, enrichment of imported donation transactions, and annual zakat obligations without forcing the transactions domain to own charitable-giving semantics.

## Shared Conceptual Models

### `Donation`
The fiscal-year charitable-giving aggregate.

- Represents voluntary giving and related charitable adjustments such as interest cleansing.
- In the current implementation this concept is realized as `DonationLedger` (header) plus `DonationPayment` rows.
- Uses fiscal-year scoping and beneficiary metadata for reporting and tax preparation.

### `ZakatObligation`
The annual obligatory-giving aggregate.

- Represents the amount due for a selected Zakat year.
- In the current implementation this concept is realized as `ZakatObligation` plus `ZakatPayment` rows.
- Uses `CalendarYear` records of type `ZAKAT` rather than fiscal-year donation calendars.

### `PaymentRecord`
A shared row-level charitable-payment contract.

Common fields:
- `datePaid`
- `amount`
- `beneficiaryType`
- beneficiary reference (`Business` or `Individual`)
- parent year/obligation reference
- optional transaction attribution when the payment is derived from imported bank activity

Specializations:
- `DonationPayment` adds `taxCategory`, `donationPurpose`, and an optional `transactionId`.
- `ZakatPayment` keeps the same beneficiary and amount structure while remaining tied to a Zakat obligation.

## Architecture Decisions

1. **Header + payment-row pattern is shared across the domain.**
   Donations and Zakat both use a year-scoped header record with many payment rows.

2. **Server-first pages, client-side editing islands.**
   Pages fetch year-scoped data on the server and delegate row editing, reducer state, and drawers to client components.

3. **Transaction linking is enrichment, not source mutation.**
   Imported `Transaction` rows remain the immutable cash evidence; charitable pages attach metadata through optional one-to-one links.

4. **Calendar semantics are explicit.**
   Donations are fiscal-year scoped; Zakat uses its own annual calendar type; both still fit the shared `PaymentRecord` pattern.

5. **User scoping is enforced through session context and owned relations.**
   Beneficiaries, linked transactions, and charitable pages are filtered through the authenticated user, even when header tables themselves do not carry a direct `userId`.

## Cross-Domain References

- **transactions** — imported donation evidence, optional `transactionId` linking, ledger badges, and unlinked-transaction discovery. See [transactions domain HLD](../transactions/hld.md).
- **income-expense** — interest-cleansing categorization, cashflow totals, and downstream tax-style reporting. See [income-expense domain HLD](../income-expense/hld.md).
- **assets** — net-worth and asset-basis data that may inform Zakat calculations and charitable overviews. See [assets domain HLD](../assets/hld.md).

## Out of Scope

- Processing donations or Zakat payments through external gateways.
- Religious or tax advice generation.
- Replacing the transactions ledger with a charitable-specific import flow.
