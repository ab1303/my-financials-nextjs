# Transfer Reconciliation — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Link Pair | `linkTransferPair()` |
| Unlink Pair | `unlinkTransferPair()` |

## UX Flow: Reconcile Transfer
```mermaid
sequenceDiagram
  participant UI as TransactionRow
  participant TRPC as transfer.link
  participant Service as linkTransferPair()
  participant DB as Transaction Tables

  UI->>TRPC: Submit Link Pair
  TRPC->>Service: Call link service
  Service->>DB: UPDATE Transaction (link + status) + reverseRollup()
  DB-->>Service: Success
  Service-->>TRPC: 200 OK
  TRPC-->>UI: 200 OK
```
