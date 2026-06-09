# Income Management — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Read Income | `getIncomeDataHandler()` |
| Get Totals | `totalIncomeHandler()` |

## UX Flow: Income Management
```mermaid
sequenceDiagram
  participant UI as IncomePage
  participant API as getIncomeDataHandler
  participant DB as Transaction Table

  UI->>API: Load Page (yearId, bankId)
  API->>DB: Query Aggregates (CREDIT)
  DB-->>API: Income Data
  API-->>UI: Render Table + Totals
```
