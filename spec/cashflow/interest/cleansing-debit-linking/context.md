# Cleansing Donations — DEBIT Evidence Retrieval (Sub-phase Context)

## Purpose

This doc describes the DEBIT evidence retrieval sub-phase within the canonical interest-cleansing flow (see interest-cleansing/context.md). It focuses on fetching candidate DEBIT transactions that may serve as evidence for allocations; it does not redefine the overall linkage model, which is M:N and credit-anchored.

## Problem Summary

The current Interest Cleansing workflow did not surface candidate DEBIT transactions (charity payments) for reviewer allocation suggestions. This sub-phase implements a backend query to surface eligible DEBIT evidence candidates to the canonical evidence picker.

## Domain Dependencies

- [Cashflow Domain HLD](../hld.md)
- [Interest Cleansing Spec](../interest-cleansing/context.md)

## IN Scope

- Implementing a query to retrieve candidate DEBIT evidence transactions for the canonical evidence picker
- Fetching CONFIRMED, unlinked DEBIT transactions filtered by the configured interest category name (do not hardcode "Bank Interest")
- Updating CleanseDonationDrawer to consume the canonical evidence-retrieval query and surface candidates
- Ensuring DonationPayment references the selected DEBIT transaction when mapped as evidence

## OUT of Scope

- Schema/model changes (none required)
- Manual entry flow (already supported)
- Linking non-interest DEBITs or multiple transactions

## Schema References

- See [cashflow hld.md](../hld.md) for full models
- Transaction: `type: 'DEBIT'`, `category: <configured interest category name>`, `status: 'CONFIRMED'`, `donationPayment: DonationPayment?`
- DonationPayment: `donationPurpose: 'INTEREST_CLEANSING'`, `transactionId: String?`

## Patterns to Reuse

- Use existing DonationPayment model and linkage pattern
- UI/UX patterns from current CleanseDonationDrawer

## Constraints & Gotchas

- Eligibility must be driven by a configurable category reference (rename-safe), not fixed string literals like "Bank Interest"
- No schema changes allowed
- Must not break CREDIT transaction logic; this is an evidence retrieval sub-phase only
- Drawer must show correct date/amount from DEBIT evidence records
