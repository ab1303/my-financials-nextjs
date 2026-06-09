# Reimbursement Tracking — Context

## Purpose
Enables tracking of inter-party payments (money paid on behalf of others or payback received) to prevent them from inflating expense reports.

## Architecture
- **Categorization**: Transactions marked as `Reimbursement` category.
- **Service**: `src/server/services/transactions/ledger.service.ts` manages offsets.
- **Ledger Integration**: `transaction-ledger` tRPC router handles category mutations and roll-ups.

## Scope
- Tracking DEBIT/CREDIT transactions as reimbursements.
- Offsetting expense categories for incoming reimbursement CREDITs.
- Excluding pending reimbursement DEBITs from expense reports.
