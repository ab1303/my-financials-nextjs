# Transaction Enrichment — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Validate Date | `validateTransactionDate()` |
| Get Candidates | `getUnlinkedZakatTransactions()` |

## UX Flow: Linking
```mermaid
sequenceDiagram
  participant UI as LinkZakatDrawer
  participant TRPC as transactionLedger.getAll
  participant DB as Transaction/Zakat Tables

  UI->>TRPC: Fetch linked status
  TRPC->>DB: Query with Zakat payment relation
  DB-->>TRPC: tx + isZakatLinked
  TRPC-->>UI: UI displays badge
```
