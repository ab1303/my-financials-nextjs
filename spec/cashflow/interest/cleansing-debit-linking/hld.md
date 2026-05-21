# Cleansing Donations — DEBIT Transaction Linking (Feature HLD)

## Problem
The Interest Cleansing workflow currently only supports linking CREDIT (interest received) transactions as evidence for cleansing donations. Users cannot link DEBIT transactions (actual payments to charities) as evidence, resulting in incomplete donation tracking and audit trails.

## Solution
Introduce support for linking DEBIT "Bank Interest" transactions (charity payments) to cleansing donations. Add a backend query to fetch unlinked DEBIT transactions, update the UI to surface these for linking, and ensure DonationPayment records reference the correct DEBIT transaction as evidence.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| 1. Only DEBIT transactions are eligible for linking as cleansing donations | DEBIT = money out (actual payment); CREDIT = money in (interest received) |
| 2. `DonationPayment.transactionId` references the DEBIT transaction | Ensures auditability and correct evidence linkage |
| 3. Only CONFIRMED DEBIT transactions with category "Bank Interest" are eligible | Prevents linking pending or unrelated payments |
| 4. Drawer UI fetches unlinked DEBIT transactions via new backend query | Ensures only valid, unlinked payments are shown for linking |
| 5. No schema changes required | Existing models support the workflow; minimizes migration risk |

## Data Model Changes
- None. Reuse `DonationPayment` with `donationPurpose = INTEREST_CLEANSING` and `transactionId` referencing the DEBIT transaction.

## Component/Service Changes
- Service: Add `getUnlinkedCleansingDebitTransactions` to interest-cleansing service
- tRPC: Add corresponding query
- UI: Update CleanseDonationDrawer to use new query and correctly attribute date/amount from DEBIT transaction

## Success Criteria
- Users can link DEBIT transactions as evidence for cleansing donations
- Linked donations show correct payment date/amount
- Only eligible, unlinked DEBIT transactions are surfaced
- No regression to CREDIT transaction logic

## Out of Scope
| Area | Reason |
|---|---|
| Schema changes | Existing models suffice |
| Manual entry flow | Already supported; not affected |
| Multi-transaction linking | Only one-to-one linkage supported |
| Non-interest categories | Only "Bank Interest" DEBITs are eligible |

## References
- [Domain HLD](../hld.md)
- [Interest Cleansing Spec](../interest-cleansing/context.md)
