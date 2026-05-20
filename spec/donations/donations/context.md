# Donations — Context

## Problem
Users need a fiscal-year view of charitable giving that records what was paid, who received it, and how it should be categorized for reporting. The legacy flat spec mixed domain design, implementation notes, and file inventory; this feature spec isolates the core donations workflow inside the donations domain.

## Domain Dependencies

- Uses the `Donation` and `PaymentRecord` patterns from the [donations domain HLD](../hld.md).
- Depends on fiscal-year `CalendarYear` records and shared beneficiary entities (`Business`, `Individual`).
- Can optionally reference the transactions domain when a donation row is linked back to imported bank activity.

## Scope

**In scope:**
- Fiscal-year donation totals and payment history.
- Inline create, edit, and delete of donation rows.
- Beneficiary capture, tax-category capture, and donation-purpose classification.
- Server-validated mutations and user-scoped beneficiary selection.

**Out of scope:**
- External payment processing.
- Automated tax advice.
- Import-wizard changes (handled by the transaction-linking feature when transaction enrichment is needed).
