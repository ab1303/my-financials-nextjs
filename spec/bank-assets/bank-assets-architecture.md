# Bank Assets Feature - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Phase 2 - Pending)                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Page: app/(authorized)/assets/banks/page.tsx                      │ │
│  │  ┌────────────────┐  ┌──────────────┐  ┌─────────────────────┐   │ │
│  │  │ Calendar Year  │  │  Grand Total │  │  Bank Accordions    │   │ │
│  │  │   Selector     │  │     Card     │  │  (Collapse/Expand)  │   │ │
│  │  └────────────────┘  └──────────────┘  └─────────────────────┘   │ │
│  │         │                    │                      │              │ │
│  │         └────────────────────┴──────────────────────┘              │ │
│  │                              ▼                                      │ │
│  │                    tRPC Client Hooks                                │ │
│  │           trpc.bankAsset.[endpoint].query|mutate()                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Phase 1 - ✅ Complete)                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  tRPC Router: src/server/trpc/router/bank-asset.ts                │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │ │
│  │  │  Queries (5)     │  │  Mutations (6)   │  │ Protected by    │ │ │
│  │  │  - getBankAccts  │  │  - createAccount │  │ Authentication  │ │ │
│  │  │  - getSnapshots  │  │  - createSnapsht │  │ (NextAuth)      │ │ │
│  │  │  - getMostRecent │  │  - updateEntry   │  │                 │ │ │
│  │  │  - getById       │  │  - updateAccount │  │ User Context    │ │ │
│  │  │  - getTotals     │  │  - deleteEntry   │  │ Injected        │ │ │
│  │  │                  │  │  - deleteSnapsht │  │                 │ │ │
│  │  └──────────────────┘  └──────────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Controllers: src/server/controllers/bank-asset.controller.ts      │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │  - Extract user context from session                         │ │ │
│  │  │  - Validate inputs (Zod schemas)                             │ │ │
│  │  │  - Call service layer                                        │ │ │
│  │  │  - Handle errors with handleCaughtError()                    │ │ │
│  │  │  - Format responses                                          │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Validation: src/server/schema/bank-asset.schema.ts               │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │  Zod Schemas:                                                │ │ │
│  │  │  - createBankAccountSchema                                   │ │ │
│  │  │  - createBankAssetSnapshotSchema                             │ │ │
│  │  │  - updateBankAssetEntrySchema                                │ │ │
│  │  │  - deleteSnapshotSchema / deleteEntrySchema                  │ │ │
│  │  │  - getSnapshotsSchema / getBankAccountsSchema                │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Service Layer: src/server/services/bank-asset.service.ts         │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │  Business Logic & Data Access:                               │ │ │
│  │  │                                                               │ │ │
│  │  │  Account Operations:                                         │ │ │
│  │  │  - createBankAccount()                                       │ │ │
│  │  │  - getBankAccounts()                                         │ │ │
│  │  │  - getBankAccountById()                                      │ │ │
│  │  │  - updateBankAccount()  [Rename accounts]                    │ │ │
│  │  │                                                               │ │ │
│  │  │  Snapshot Operations:                                        │ │ │
│  │  │  - createBankAssetSnapshot() [Transaction]                  │ │ │
│  │  │  - getBankAssetSnapshots()                                   │ │ │
│  │  │  - getMostRecentSnapshot()                                   │ │ │
│  │  │  - getSnapshotById()                                         │ │ │
│  │  │  - getSnapshotTotals() [Aggregation]                        │ │ │
│  │  │                                                               │ │ │
│  │  │  Entry Operations:                                           │ │ │
│  │  │  - updateBankAssetEntry()                                    │ │ │
│  │  │  - deleteBankAssetEntry()                                    │ │ │
│  │  │  - deleteBankAssetSnapshot()                                 │ │ │
│  │  │                                                               │ │ │
│  │  │  🔐 All operations filter by userId                          │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Prisma Client (ORM)                                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SQL Queries
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL)                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  ┌──────────────┐         ┌─────────────────────┐                 │ │
│  │  │  User        │         │  Business           │                 │ │
│  │  │  ──────────  │         │  (type=BANK)        │                 │ │
│  │  │  - id        │         │  ──────────────────  │                 │ │
│  │  │  - email     │◄───┐    │  - id               │                 │ │
│  │  │  - name      │    │    │  - name             │                 │ │
│  │  └──────────────┘    │    │  - type             │                 │ │
│  │         ▲             │    │  - userId ──────────┼────┘            │ │
│  │         │             │    └─────────────────────┘                 │ │
│  │         │             │               ▲                            │ │
│  │  ┌──────┴──────────┐  │               │                            │ │
│  │  │  BankAccount    │  │               │                            │ │
│  │  │  ──────────────  │  │               │                            │ │
│  │  │  - id           │  │               │                            │ │
│  │  │  - name         │  │               │                            │ │
│  │  │  - bankId ──────┼──┘               │                            │ │
│  │  │  - userId ──────┼──────────────────┘                            │ │
│  │  └─────────────────┘                                               │ │
│  │         ▲                                                           │ │
│  │         │                                                           │ │
│  │  ┌──────┴──────────────┐       ┌──────────────────────┐           │ │
│  │  │  BankAssetEntry     │       │  BankAssetSnapshot   │           │ │
│  │  │  ─────────────────  │       │  ──────────────────  │           │ │
│  │  │  - id               │       │  - id                │           │ │
│  │  │  - balance @db.Money│       │  - snapshotDate      │           │ │
│  │  │  - accountId ───────┼───┘   │  - userId ───────────┼───┐       │ │
│  │  │  - snapshotId ──────┼──────►│                      │   │       │ │
│  │  └─────────────────────┘       └──────────────────────┘   │       │ │
│  │                                           ▲                │       │ │
│  │                                           │                │       │ │
│  │                                           └────────────────┘       │ │
│  │                                                                     │ │
│  │  Indexes:                                                          │ │
│  │  - BankAccount: [userId, bankId]                                  │ │
│  │  - BankAssetSnapshot: [userId, snapshotDate]                      │ │
│  │  - BankAssetEntry: [snapshotId]                                   │ │
│  │                                                                     │ │
│  │  Unique Constraints:                                               │ │
│  │  - BankAccount: [name, bankId, userId]                            │ │
│  │  - BankAssetEntry: [accountId, snapshotId]                        │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: Create Snapshot

```
User clicks "New Snapshot"
         │
         ▼
Frontend calls: trpc.bankAsset.createSnapshot.mutate({
  snapshotDate: Date,
  entries: [{ accountId, balance }, ...]
})
         │
         ▼
tRPC Router → Controller → Validates with Zod
         │
         ▼
Service Layer: createBankAssetSnapshot()
         │
         ├─► Starts Transaction
         ├─► Verifies all accounts belong to user
         ├─► Creates BankAssetSnapshot record
         ├─► Creates BankAssetEntry records
         └─► Commits Transaction
         │
         ▼
Returns snapshot with entries to frontend
         │
         ▼
Frontend displays new snapshot, updates totals
```

### Example 2: Get Snapshot Totals

```
User selects calendar year
         │
         ▼
Frontend calls: trpc.bankAsset.getMostRecentSnapshot.query({
  calendarYearId: "..."
})
         │
         ▼
Service calculates date range from calendar year
         │
         ▼
Queries BankAssetSnapshot filtered by:
  - userId (security)
  - snapshotDate between [fromDate, toDate]
  - ORDER BY snapshotDate DESC
  - LIMIT 1
         │
         ▼
Returns snapshot → Frontend calls getTotals
         │
         ▼
Service aggregates:
  - Groups entries by bank
  - Sums balances per bank
  - Calculates grand total
         │
         ▼
Returns:
{
  grandTotal: 125000,
  banks: [
    { bankName: "ANZ", total: 50000, accounts: [...] },
    { bankName: "CBA", total: 75000, accounts: [...] }
  ]
}
         │
         ▼
Frontend displays accordion with totals
```

## Security Flow

```
Every Request
      │
      ▼
┌─────────────────┐
│ Authentication  │ ← NextAuth Session
│ Check           │
└─────────────────┘
      │
      ▼ Authenticated?
      │
      ├─ No ──► 401 Unauthorized
      │
      └─ Yes
         │
         ▼
┌─────────────────┐
│ Extract userId  │
│ from session    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Service Layer   │
│ Filters all     │ ← WHERE userId = session.user.id
│ queries by      │
│ userId          │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ For Updates/    │
│ Deletes:        │
│ Verify resource │ ← Check ownership before modification
│ belongs to user │
└─────────────────┘
         │
         ▼
   Operation
   Executed
```

---

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **State Management**: tRPC + React Query
- **Backend**: tRPC, Next.js API Routes
- **Validation**: Zod
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: NextAuth.js

---

## Key Design Patterns

1. **Service Layer Pattern**: Business logic separated from controllers
2. **Repository Pattern**: Prisma abstracts database access
3. **Validation Layer**: Zod schemas for runtime type safety
4. **Protected Procedures**: Authentication enforced at router level
5. **Transaction Pattern**: Atomic operations for consistency
6. **Aggregation Pattern**: Calculated totals for display efficiency

---

**Architecture Version**: 1.0  
**Last Updated**: 2026-01-31  
**Status**: Phase 1 Complete ✅
