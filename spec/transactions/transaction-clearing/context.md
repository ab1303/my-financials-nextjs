# Transaction Clearing (Void & Undo) — Context

## Problem
The import pipeline needs a robust reversal mechanism to correct incorrect confirmed imports without creating duplicate data or orphan records.

## Architecture
- **Voiding**: Transactions are marked as `VOIDED` (terminal state) rather than hard-deleted.
- **Service Layer**: `src/server/services/transactions/void.service.ts` handles the reversal of downstream writes (`MonthlyExpenseSummary`, `IncomeRecord`).
- **API**: `transactionClearing` tRPC router (`src/server/trpc/router/transaction-clearing.ts`).

## Scope
- Atomic reversal of import sessions and individual transactions.
- Audit trail via session and transaction status management.
