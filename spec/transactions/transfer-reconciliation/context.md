# Transfer Reconciliation — Context

## Problem
Inter-account transfers inflate expense reports if both sides are not correctly reconciled.

## Architecture
- **Categorization**: CREDIT side marked as `Transfer` (status `EXCLUDED`).
- **Linking**: `Transaction` self-referential `"TransferLink"` relation.
- **Service**: `src/server/services/transactions/transfer.service.ts` manages linking and rollup reversal.

## Scope
- Tracking DEBIT/CREDIT transfer pairs.
- Excluding transfer DEBITs from expense roll-ups.
- Linking UI in ledger for manual reconciliation.
