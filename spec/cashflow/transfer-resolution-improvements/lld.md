# Transfer Resolution UX — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Auto-Detect | `runRetroactiveDetection()` |
| Resolve | `resolveOrphan()` |

## UX Flow: Orphan Resolution
```mermaid
sequenceDiagram
  participant UI as OrphanResolutionPanel
  participant TRPC as transfer.resolveOrphan
  participant DB as Transaction Table

  UI->>TRPC: Submit Resolution (category)
  TRPC->>DB: UPDATE Transaction (orphanResolution)
  DB-->>TRPC: Success
  TRPC-->>UI: 200 OK
```
