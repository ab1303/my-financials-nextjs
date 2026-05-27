# Donations — Context

## Problem
Users need a fiscal-year view of charitable outflows that records what was paid, who received it, and how it should be categorized for reporting. This feature now lives under the cashflow domain because donations are a money-out workflow alongside expenses, while still preserving their distinct charitable semantics.

## Architecture Note — Why Donations Are NOT in the Transaction Table

Unlike Income and Expense (which are simple flows and use `Transaction` as their sole source 
of truth), Donations have **rich metadata** that exceeds `Transaction`'s schema:

- **Beneficiary** (Business or Individual, with specific entity references)
- **Tax category** (ATO deduction classification)
- **Donation purpose** (VOLUNTARY vs INTEREST_CLEANSING)
- **Beneficiary type** (INDIVIDUAL vs BUSINESS)

These fields have no place in the Transaction model. Instead, `DonationPayment` IS the source 
of truth for charitable semantics. An **optional** `transactionId` link provides reconciliation 
against imported bank evidence without duplicating data.

This follows the **enrichment pattern** (HLD Decision #3 & #4): Transaction is immutable cash 
evidence; DonationPayment attaches metadata via optional one-to-one links.

## Domain Dependencies

- Uses `DonationRecord`, `CharitablePaymentRecord`, and the donations-outflow rules from [`../../hld.md`](../../hld.md).
- Depends on fiscal-year `CalendarYear` records and shared beneficiary entities (`Business`, `Individual`).
- May reconcile against imported transaction evidence from the [transactions domain HLD](../../../transactions/hld.md) when a donation row is linked back to bank activity.
- Shares money-out reporting boundaries with expense tracking while preserving beneficiary and tax metadata.
- Bank account filtering (optional): when a bank filter is active, show only donations whose linked `transactionId → Transaction.bankAccountId` matches. Manual donations (no transactionId) always appear.

## Scope

**In scope:**
- Fiscal-year donation totals and payment history.
- Inline create, edit, and delete of donation rows.
- Beneficiary capture, tax-category capture, and donation-purpose classification.
- Server-validated mutations and user-scoped beneficiary selection.
- Optional bank account filter for linked transactions.

**Out of scope:**
- External payment processing.
- Automated tax or charitable advice.
- Import-wizard changes (handled by the transaction-linking feature when transaction enrichment is needed).
