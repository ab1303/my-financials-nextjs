# Donations - Context

## Problem
Users need a fiscal-year view of charitable outflows that records what was paid, who received it, why it was paid, and whether it is deductible. The donations workflow sits in the cashflow domain because it is a money-out flow with charitable semantics, reporting needs, and bank reconciliation.

## Product Decisions
- `DonationPayment` is the source of truth for charitable semantics, not `Transaction`.
- Donation purpose is a first-class, editable field with two values: `VOLUNTARY` and `INTEREST_CLEANSING`.
- DGR status is derived from the linked `Business` record, not duplicated on the payment row.
- The transaction-ledger entry point must support a unified classification choice that routes a payment into Donation or Zakat, rather than forcing users through donation-only linking.
- Zakat and donations must both contribute to year-end deductible reporting.
- When enriching a donation from the ledger, the beneficiary type should default to `Business` so the common charitable case is one click less friction; `Individual` remains an explicit exception.

## Architecture Note - Why Donations Are NOT in the Transaction Table
Unlike income and expense, donations require rich charitable metadata that exceeds `Transaction`:
- Beneficiary (Business or Individual, with specific entity references)
- Beneficiary type (INDIVIDUAL or BUSINESS)
- Donation purpose (VOLUNTARY or INTEREST_CLEANSING)

These fields belong on `DonationPayment`, with an optional `transactionId` link for reconciliation against imported bank evidence. This follows the enrichment pattern: `Transaction` is immutable cash evidence; `DonationPayment` attaches charitable semantics through an optional one-to-one link.

## Domain Dependencies
- Uses `DonationRecord`, `CharitablePaymentRecord`, and the donations-outflow rules from [`../../hld.md`](../../hld.md).
- Depends on fiscal-year `CalendarYear` records and shared beneficiary entities (`Business`, `Individual`).
- May reconcile against imported transaction evidence from the transactions domain when a donation row is linked back to bank activity.
- Shares money-out reporting boundaries with expense tracking while preserving beneficiary, purpose, and tax metadata.
- Bank account filtering (optional): when a bank filter is active, show only donations whose linked `transactionId -> Transaction.bankAccountId` matches. Manual donations (no `transactionId`) always appear.

## Scope
**In scope:**
- Fiscal-year donation totals and payment history.
- Inline create, edit, and delete of donation rows.
- Beneficiary capture, purpose capture, and derived deductible-status display.
- Beneficiary capture, purpose capture, and DGR-derived reporting.
- Server-validated mutations and user-scoped beneficiary selection.
- Unified transaction classification entry from the ledger.
- Optional bank account filter for linked transactions.
- Reporting that breaks down totals by donation purpose and deductible status.

**Out of scope:**
- External payment processing.
- Automated tax or charitable advice.
- Import-wizard changes outside the transaction-classification flow.

## Acceptance Criteria
- Users can see and edit donation purpose on every donation row.
- DGR status is derived from the selected beneficiary and cannot be manually overridden.
- A donation row shows whether it is deductible before save and after edit.
- The donations page shows totals by purpose and deductible status, not only one blended total.
- The ledger classification entry can route a transaction into Donation or Zakat without ambiguity.
