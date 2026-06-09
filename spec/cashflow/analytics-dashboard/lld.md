# Cashflow Analytics Dashboard — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Get Monthly Income | `getMonthlyIncomeSummaryFiltered()` |
| Get Income Breakdown | `getIncomeSourceBreakdownForYear()` |
| Get Expense Breakdown | `getExpenseCategoryBreakdownForYear()` |

## UX Flow: Analytics Data Fetch
```mermaid
sequenceDiagram
  participant UI as CashflowAnalyticsClient
  participant API as /api/cashflow/analytics
  participant Service as Income/Expense Services
  participant DB as Transaction/Summary Tables

  UI->>API: GET /analytics (yearId, bankId)
  API->>Service: Parallel calls (Promise.all)
  Service->>DB: Aggregations (Income, Expenses, Breakdown)
  DB-->>Service: Aggregated Data
  Service-->>API: JSON Response
  API-->>UI: CashflowAnalyticsData
```
