# Transaction Clearing — Low Level Design

## Service Contracts

| Action | Service Call |
|---|---|
| Void | `voidTransaction()` |
| Undo Session | `undoImportSession()` |

## UX Flow: Undo Import
```mermaid
sequenceDiagram
  participant UI as ImportSessionHistory
  participant TRPC as transactionClearing.undoImportSession
  participant Service as undoImportSession()
  participant DB as Transaction/Expense/Income Tables

  UI->>TRPC: Request Undo (sessionId)
  TRPC->>Service: Call void service
  Service->>DB: reverseDownstream() + UPDATE session status
  DB-->>Service: Success
  Service-->>TRPC: 200 OK
  TRPC-->>UI: 200 OK
```
