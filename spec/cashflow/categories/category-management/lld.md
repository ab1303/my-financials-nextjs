# Category Management — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| List Sources/Categories | `getAllActive()` |
| CRUD Operations | `create()`, `rename()`, `deactivate()` |

## UX Flow: Management
```mermaid
sequenceDiagram
  participant UI as SettingsCategories
  participant TRPC as incomeSource.create / expenseCategory.create
  participant DB as IncomeSource / ExpenseCategory Tables

  UI->>TRPC: Submit CRUD operation
  TRPC->>DB: INSERT/UPDATE record
  DB-->>TRPC: Success
  TRPC-->>UI: Refetch list
```
