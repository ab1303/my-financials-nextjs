# Transaction Linking — Context

## Problem
Imported `DEBIT` transactions categorized as `Gifts & donations` must be enriched with beneficiary and purpose metadata and linked to domain-specific donation records.

## Scope
- Detecting unlinked donation transactions for the selected fiscal year.
- Drawer workflow to create `transactionId` links.
- Reclassifying transactions in the ledger.
