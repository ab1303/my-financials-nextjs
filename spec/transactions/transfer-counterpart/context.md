# Transfer Counterpart Display — Context

## Problem
Linked transfer pairs (DEBIT/CREDIT) lack visible counterpart information in the ledger, forcing users to manually search for linked transactions.

## Architecture
- **Linking**: Self-referential 1:1 `"TransferLink"` relation on `Transaction`.
- **Querying**: `transactionLedger` tRPC router (`getAll`) coalesces `transferLinkedTransaction` and `transferCounterpart` relations.
- **UI**: `TransactionRow` displays counterpart summary chips.
