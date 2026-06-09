# Multi-Account Transfer Integrity — Low Level Design

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
  participant DB as Transaction Table

  UI->>TRPC: Link DEBIT/CREDIT
  TRPC->>Service: Call link service
  Service->>DB: UPDATE pair (status=EXCLUDED) + Reverse Rollup
  DB-->>Service: Success
  Service-->>TRPC: 200 OK
  TRPC-->>UI: 200 OK
```
