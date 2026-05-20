# Donations — Context

## Problem
Users need a fiscal-year view of charitable outflows that records what was paid, who received it, and how it should be categorized for reporting. This feature now lives under the cashflow domain because donations are a money-out workflow alongside expenses, while still preserving their distinct charitable semantics.

## Domain Dependencies

- Uses `DonationRecord`, `CharitablePaymentRecord`, and the donations-outflow rules from [`../../hld.md`](../../hld.md).
- Depends on fiscal-year `CalendarYear` records and shared beneficiary entities (`Business`, `Individual`).
- May reconcile against imported transaction evidence from the [transactions domain HLD](../../../transactions/hld.md) when a donation row is linked back to bank activity.
- Shares money-out reporting boundaries with expense tracking while preserving beneficiary and tax metadata.

## Scope

**In scope:**
- Fiscal-year donation totals and payment history.
- Inline create, edit, and delete of donation rows.
- Beneficiary capture, tax-category capture, and donation-purpose classification.
- Server-validated mutations and user-scoped beneficiary selection.

**Out of scope:**
- External payment processing.
- Automated tax or charitable advice.
- Import-wizard changes (handled by the transaction-linking feature when transaction enrichment is needed).
