# Donations - Context

## Problem
Users need a fiscal-year view of charitable outflows (Voluntary, Interest Cleansing, Zakat) that records what was paid, who received it, purpose, and deductibility.

## Architecture
The system uses purpose-scoped models for persistence (`VoluntaryDonation`, `InterestCleansing`, `ZakatPayment`). The frontend interacts with a unified API shape (`DonationPaymentModel`) via adapter logic in the donation service layer.

## Product Decisions
- Donation purpose is a first-class, editable field: `VOLUNTARY`, `INTEREST_CLEANSING`, `ZAKAT`.
- DGR status is derived from the linked `Business` entity.
- Zakat and donations contribute to unified year-end reporting.
- Default beneficiary type is `Business`.

## Scope
- Fiscal-year totals and payment history.
- CRUD operations for all donation types.
- Reporting by purpose and deductible status.
- Optional linking to `Transaction` for bank reconciliation.
