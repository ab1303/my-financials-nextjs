# Transaction Linking — Context

## Problem
Imported `DEBIT` transactions categorized as `Gifts & donations` land in the transactions/expense pipeline without the beneficiary and tax metadata required by the donations workflow. Users are forced to double-enter the same charitable payment unless the imported transaction can be enriched and linked to a `DonationPayment`.

## Domain Dependencies

- Uses the `Donation` and `PaymentRecord` concepts from the [donations domain HLD](../hld.md).
- Depends on immutable imported `Transaction` records and ledger visibility patterns from the [transactions domain HLD](../../transactions/hld.md).
- Reuses fiscal-year selection from the donations feature so enrichment happens in the same user context as donation reporting.

## Scope

**In scope:**
- Detecting unlinked imported donation transactions for the selected fiscal year.
- Showing a banner and drawer workflow on the Donations page.
- Creating an optional one-to-one `DonationPayment.transactionId` link.
- Preserving manual donations that have no transaction link.

**Out of scope:**
- Changing the CSV import wizard.
- Fuzzy beneficiary matching or bulk linking.
- Unlink/relink flows beyond the one-to-one donation enrichment path.
