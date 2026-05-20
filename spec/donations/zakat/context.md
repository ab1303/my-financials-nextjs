# Zakat — Context

## Problem
Users need to record an annual Zakat obligation and the individual payments made against that obligation for a selected Zakat year. The legacy docs mixed a product brief and implementation tracking; this feature spec re-centers the work around the obligation/payment workflow and its domain dependencies.

## Domain Dependencies

- Uses the `ZakatObligation` and `PaymentRecord` concepts from the [donations domain HLD](../hld.md).
- Depends on `CalendarYear` records of type `ZAKAT`.
- May reference the [income-expense](../../income-expense/hld.md) and [assets](../../assets/hld.md) domains when extending how `amountDue` is calculated or explained.
- Reuses shared beneficiary entities and authenticated user context in the same way as the donations feature.

## Scope

**In scope:**
- Selecting a Zakat year.
- Storing `amountDue` for that year.
- Creating, editing, and deleting Zakat payment rows.
- Capturing beneficiary type and beneficiary for each payment.

**Out of scope:**
- A jurisprudential rules engine for automatically computing Zakat due.
- Payment processing.
- Multi-user or accountant-style delegation workflows.
