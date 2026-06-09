# Interest Cleansing — Low-Level Design (LLD)

## Service Mapping

| Action | Service Call |
|---|---|
| Create/Apply | `applyAllocations()` |
| Fuzzy Suggest | `suggestAllocations()` |

## UX Flows
### 1) Create Allocation
```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as applyAllocations()
  participant DB as DB (InterestCleansingEvidence)

  UI->>API: POST /allocations {payload}
  API->>DB: INSERT into InterestCleansingEvidence
  DB-->>API: Success
  API-->>UI: 200 OK
```
