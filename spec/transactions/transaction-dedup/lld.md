# Transaction Deduplication — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Build Dedup Set | `buildDedupSet()` |
| Make Key | `makeDedupKey()` |

## UX Flow: Import Deduplication
```mermaid
sequenceDiagram
  participant Wizard as CSV Confirm
  participant Service as buildDedupSet()
  participant DB as Transaction Table

  Wizard->>Service: Build set of existing keys
  Service->>DB: Query confirmed transactions
  DB-->>Service: Set of dedup keys
  Wizard->>Wizard: Filter new transactions using isDuplicate()
  Wizard->>DB: INSERT only new, unique records
```
