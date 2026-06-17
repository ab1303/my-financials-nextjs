# Transaction Ledger — Context

## Problem
The transaction import pipeline writes records that were previously invisible, preventing users from browsing, correcting, or auditing their financial data.

## Architecture
- **Persistence**: `Transaction` model.
- **Service Layer**: `src/server/services/transactions/ledger.service.ts`.
- **API**: `transactionLedger` tRPC router (`src/server/trpc/router/transaction-ledger.ts`).

## Scope
- Paginated table of all transactions.
- Inline category editing with automated re-rollup.
- Filtering by bank account, date range, and description.
- Status management (ALL, Expenses, Income, Excluded, Voided).
