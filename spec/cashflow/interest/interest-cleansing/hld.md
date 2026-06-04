High-Level Design: Interest Cleansing

Overview

Interest cleansing links bank "Credit Interest" (inbound credit transactions) to donor-related DEBIT transactions (donations) that act as evidence that the credit should be considered settled/cleaned. Current system treats donations as DEBITs but only stores a loose relationship; we will introduce an explicit many-to-many allocation model so one credit can be cleaned by multiple evidence donations and one donation can evidence multiple credits.

Goals

- Support M:N linking between credit interest transactions and donation DEBIT evidence with partial allocations.
- Backfill historical data using a fuzzy-match algorithm and provide manual reconciliation UI for ambiguous cases.
- Preserve full audit trail and enable precise accounting and reporting.

Key Concepts

- Credit: a bank inbound transaction with description "Credit Interest" or equivalent.
- Evidence (Donation): an outbound DEBIT transaction that represents donor money used to clean credits. Evidence transactions are existing Donation/Payment records.
- Allocation: an explicit amount linking a Credit to an Evidence DEBIT. Multiple allocations may sum to the full amount of either side.

Non-Goals

- Change the accounting semantics of existing reconciled credits beyond allocation tracking.
- Perform destructive DB operations without following migration safety rules.

Success Criteria

- UI allows selecting multiple Evidence DEBITs and specifying allocation amounts (including partial allocations).
- APIs and DB support M:N with amount-applied and are performant for backfill.
- Backfill produces suggested allocations with confidence scores; reviewer can accept/reject/adjust.
