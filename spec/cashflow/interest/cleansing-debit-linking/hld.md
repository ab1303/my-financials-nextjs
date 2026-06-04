# Cleansing Donations — DEBIT Evidence Retrieval (Sub-phase HLD)

## Purpose

This HLD describes a focused sub-phase that implements DEBIT evidence candidate retrieval for the canonical interest-cleansing flow. It does not change the canonical linkage semantics (M:N credit-anchor + debit-evidence) and must align with `interest-cleansing/hld.md`.

## Solution

Provide a backend query that retrieves eligible DEBIT evidence transactions (configured interest category, CONFIRMED, unlinked) and surface them in the canonical evidence picker UI. This enables reviewers to select and allocate evidence as part of the M:N allocation workflow.

## Architecture Decisions

| Decision                                                                                                    | Rationale                                                            |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Evidence retrieval is a sub-phase, not a separate one-to-one linkage model                               | Keeps the canonical M:N model intact and avoids conflicting UIs      |
| 2. `DonationPayment.transactionId` may reference a DEBIT evidence row when mapped via allocations           | Ensures auditability while preserving allocation semantics           |
| 3. Eligibility is determined by a configurable interest category name (rename-safe) and confirmation status | Prevents hardcoded category name breakage and supports admin renames |
| 4. Drawer UI consumes canonical evidence retrieval query                                                    | Ensures consistent UX across credit-anchored allocation flows        |
| 5. No schema changes required for this retrieval sub-phase                                                  | Minimizes migration risk                                             |

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

| Area                      | Reason                                   |
| ------------------------- | ---------------------------------------- |
| Schema changes            | Existing models suffice                  |
| Manual entry flow         | Already supported; not affected          |
| Multi-transaction linking | Only one-to-one linkage supported        |
| Non-interest categories   | Only "Bank Interest" DEBITs are eligible |

## References

- [Domain HLD](../hld.md)
- [Interest Cleansing Spec](../interest-cleansing/context.md)
