# Interest Cleansing — Context

## Problem
The bank-interest flow must track interest received and the donations used to cleanse it without forcing users into disconnected manual ledgers. Interest is a special cash inflow: it affects cashflow visibility, but it must remain segregated from ordinary income and reconciled against a yearly cleansing obligation.

## Domain Dependencies

- Uses `CashflowPeriod`, `InterestCredit`, and `InterestCleansingDonation` from [`../../hld.md`](../../hld.md).
- Depends on transaction-ledger evidence for interest received and donation-ledger records for cleansing payments.
- Shares auditability requirements with the cashflow audit feature because the route combines filters, aggregation, and interactive remediation.

## Scope

**In scope:**
- Deriving interest received from bank transactions with monthly visibility.
- Recording cleansing donations through linked or manual paths.
- Showing annual totals, remaining obligation, and unlinked follow-up work.

**Out of scope:**
- Treating interest as ordinary income.
- Replacing the transactions or donations domains as canonical data owners.
- Broader charitable-giving workflows unrelated to interest cleansing.