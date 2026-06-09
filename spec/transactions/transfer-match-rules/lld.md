# Transfer Match Rules — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Create Rule | `createRuleFromPair()` |
| Run Rules | `runTransferMatchRules()` |

## UX Flow: Auto-Match
```mermaid
sequenceDiagram
  participant Import as CSV Confirm
  participant Service as runTransferMatchRules()
  participant DB as Transaction/Transfer Tables

  Import->>Service: Trigger after confirmation
  Service->>DB: Query for rule matches
  Service->>DB: UPDATE Transaction + linkTransferPair()
  DB-->>Service: Success
```
