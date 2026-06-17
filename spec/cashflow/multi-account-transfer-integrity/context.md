# Multi-Account Transfer Integrity — Context

## Problem
Bank CSV imports from multiple accounts generate duplicate DEBIT/CREDIT records for inter-account transfers, inflating expense/income reports unless reconciled as "Transfer" pairs.

## Architecture
- **Linking**: Self-referential 1:1 `transferLinkedTransactionId` on `Transaction`.
- **Exclusion**: Reconciled transfers are marked `category='Transfer'` and `status='EXCLUDED'`.
- **Service**: `transfer.service.ts` manages linking and rollup reversal.

## Scope
- Tracking DEBIT/CREDIT transfer pairs.
- Excluding transfer DEBITs from expense roll-ups.
- Automated and manual transfer linking.
