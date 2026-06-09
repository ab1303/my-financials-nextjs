# Category Rules — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Create | `createRule()` |
| List | `listRules()` |
| Toggle/Delete | `toggleRule()` / `deleteRule()` |
| Find Similar | `findSimilarTransactions()` |
| Run Rules | `runCategoryRules()` |
| Apply to Past | `applyRuleToPast()` |

## UX Flow: Create Rule
```mermaid
sequenceDiagram
  participant UI as TransactionRow
  participant TRPC as categoryRule.create
  participant Service as createRule()
  participant DB as CategoryRule Table

  UI->>UI: Detect Similar Transactions
  UI->>UI: Open Drawer
  UI->>TRPC: Submit Rule (pattern, matchType, category)
  TRPC->>Service: Call createRule()
  Service->>DB: INSERT into CategoryRule
  DB-->>Service: Rule Created
  Service-->>TRPC: 200 OK
  TRPC-->>UI: Close Drawer
```

## UX Flow: Run Rules (Import)
```mermaid
sequenceDiagram
  participant Import as CSV Confirm
  participant Service as runCategoryRules()
  participant DB as Transaction Table

  Import->>Service: Trigger after confirmation
  Service->>DB: UPDATE transactions matching rules
  DB-->>Service: rows updated
```
