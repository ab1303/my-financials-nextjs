# Zakat — Context

## Problem
Users need to record an annual Zakat obligation and the individual payments made against that obligation for a selected Zakat year. This feature now sits under the cashflow donations subgroup because Zakat is a beneficiary-aware cash outflow that belongs beside other charitable giving workflows.

## Domain Dependencies

- Uses `ZakatObligation`, `CharitablePaymentRecord`, and the donations-outflow rules from [`../../hld.md`](../../hld.md).
- Depends on `CalendarYear` records of type `ZAKAT`.
- May reference the [assets domain HLD](../../../assets/hld.md) when extending how `amountDue` is calculated or explained.
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
