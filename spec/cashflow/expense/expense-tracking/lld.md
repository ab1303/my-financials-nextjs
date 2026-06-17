# Expense Tracking — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Read Expenses | `getExpenseEntriesForMonth()` |
| Breakdown | `getCategoryBreakdownForYear()` |

## UX Flow: Expense Management
```mermaid
sequenceDiagram
  participant UI as ExpensePage
  participant API as getExpenseDataHandler
  participant Service as getCategoryBreakdownForYear
  participant DB as Transaction Table

  UI->>API: Load Page (yearId, bankId)
  API->>Service: Get Breakdown
  Service->>DB: Query Aggregates (DEBIT)
  DB-->>Service: Expense Data
  Service-->>API: Breakdown Response
  API-->>UI: Render Chart + Table
```
