# Transactions (Import Pipeline) — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Classify | `classifyTransactions()` |
| Confirm | `confirmDebitTransactions()` |

## UX Flow: CSV Import
```mermaid
sequenceDiagram
  participant UI as Import Wizard
  participant API as /api/transactions/csv/confirm
  participant Service as confirmDebitTransactions()
  participant DB as Transaction/Summary Tables

  UI->>API: POST /confirm {transactions}
  API->>Service: Call confirm service
  Service->>DB: INSERT Transaction + UPSERT MonthlyExpenseSummary
  DB-->>Service: Success
  Service-->>API: 200 OK
```
