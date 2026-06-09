# Reimbursement Tracking — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Apply Offset | `applyReimbursementOffset()` |
| Reverse Offset | `reverseReimbursementOffset()` |

## UX Flow: Assign Reimbursement
```mermaid
sequenceDiagram
  participant UI as TransactionRow
  participant TRPC as transactionLedger.updateCategory
  participant Ledger as applyReimbursementOffset()
  participant DB as Transaction/MonthlyExpense Tables

  UI->>TRPC: Update Category to "Reimbursement"
  TRPC->>Ledger: Call applyReimbursementOffset()
  Ledger->>DB: UPDATE Transaction + MonthlyExpenseSummary
  DB-->>Ledger: Success
  Ledger-->>TRPC: 200 OK
  TRPC-->>UI: 200 OK
```
