# Zakat - Context

## Problem
Users need to record an annual Zakat obligation and the individual payments made against that obligation for a selected Zakat year. Zakat belongs beside donations in the cashflow domain because it is a beneficiary-aware cash outflow, but it has its own year-scoped obligation header and reporting.

## Product Decisions
- Zakat is tracked separately from voluntary donations, but both must be visible in a unified deductible summary.
- Zakat payments can be linked back to imported bank transactions just like donations.
- Tax deductibility is derived from the beneficiary's DGR status, not from the fact that the payment is Zakat.
- The unified ledger classification flow must route Zakat as its own destination, so users can classify a payment before they decide whether it belongs in Donations or Zakat.
- Zakat payment rows should expose the same beneficiary-driven tax category snapshot used in Donations.
- When linking a Zakat transaction, the beneficiary type should default to `Business` to match the common charitable recipient flow; `Individual` remains an explicit exception.

## Domain Dependencies
- Uses `ZakatObligation`, `CharitablePaymentRecord`, and the donations-outflow rules from [`../../hld.md`](../../hld.md).
- Depends on `CalendarYear` records of type `ZAKAT`.
- May reference the assets domain HLD when extending how `amountDue` is calculated or explained.
- Reuses shared beneficiary entities and authenticated user context in the same way as the donations feature.
- May reconcile against imported transaction evidence via an optional `transactionId` link on each Zakat payment row.

## Scope
**In scope:**
- Selecting a Zakat year.
- Storing `amountDue` for that year.
- Creating, editing, and deleting Zakat payment rows.
- Capturing beneficiary type and beneficiary for each payment.
- Capturing derived tax category for each payment row.
- Showing Zakat totals in the year-end deductible summary.

**Out of scope:**
- A jurisprudential rules engine for automatically computing Zakat due.
- Payment processing.
- Multi-user or accountant-style delegation workflows.

## Acceptance Criteria
- Users can manage payment rows only for the selected Zakat year.
- `amountDue` remains attached to the year-scoped obligation header, not duplicated on each payment row.
- Payment mutations validate date, positive amount, beneficiary type, and session state.
- Beneficiary selection remains compatible with both `BUSINESS` and `INDIVIDUAL` paths in the current service layer.
- Zakat payments can contribute to the same deductible summary used by donations.
