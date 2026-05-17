# Import Session Date Range — Context

## Problem

The Import History dialog (`ImportSessionHistory.tsx`) shows when an import was _performed_ (the `createdAt` timestamp of the `ImportSession`) but not _what period_ the imported transactions cover. A user who imports a 6-month bank statement has no way to tell at a glance whether the file covered Jan–Jun or Jul–Dec. The `ImportSession` model has no `startDate` / `endDate` fields.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `prisma/migrations/{timestamp}_add_import_session_date_range/migration.sql` | Add nullable `startDate` / `endDate` columns to `ImportSession` |

### Files to MODIFY

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `startDate DateTime?` and `endDate DateTime?` to `ImportSession` model |
| `src/app/api/transactions/csv/confirm/route.ts` | After writing transactions, query `min(date)` / `max(date)` and write to `ImportSession` |
| `src/server/trpc/router/transaction-clearing.ts` | Include `startDate` / `endDate` in `listImportSessions` response |
| `src/components/transactions/ImportSessionHistory.tsx` | Add "Coverage" column displaying the date range |

---

## Schema Details

### Current `ImportSession` model

```prisma
model ImportSession {
  id                String           @id @default(cuid())
  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId            String
  importType        ImportTypeEnum
  status            ImportStatusEnum @default(PENDING)
  overallConfidence Float?
  recordsCreated    Int              @default(0)
  metadata          Json?
  images            ImportImage[]
  usageLogs         AIUsageLog[]
  transactions      Transaction[]
  matchJobResults   TransferMatchJobResult[]
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([userId, createdAt])
}
```

### Target schema diff

```prisma
model ImportSession {
  // ... existing fields ...
  startDate         DateTime?        // earliest transaction date in this import
  endDate           DateTime?        // latest transaction date in this import
  // ... rest unchanged ...
}
```

### `Transaction` model (relevant fields)

```prisma
model Transaction {
  id              String    @id @default(cuid())
  date            DateTime
  importSessionId String?
  importSession   ImportSession?
  // ...
}
```

---

## Existing Patterns to Reuse

### CSV confirm flow (`src/app/api/transactions/csv/confirm/route.ts`)

After `confirmDebitTransactions` / `confirmCreditTransactions` complete and before returning the response, the route already calls `prisma.importSession.update(...)` to write `status` and `recordsCreated`. The date range update fits naturally in the same `update` call.

```typescript
// Current update at line 86–92
await prisma.importSession.update({
  where: { id: fileId },
  data: {
    status,
    recordsCreated: totalEntries,
  },
});
```

### Date range query pattern

Use Prisma aggregate to avoid loading all transactions into memory:

```typescript
const dateRange = await prisma.transaction.aggregate({
  where: { importSessionId: fileId },
  _min: { date: true },
  _max: { date: true },
});
```

### tRPC `listImportSessions` shape (current)

```typescript
{
  id: string;
  importType: string;
  status: string;
  recordsCreated: number;
  transactionCount: number;
  createdAt: string;            // ISO string
  yearWarning: boolean;
  isLocked: boolean;
}
```

### `SessionRow` interface in `ImportSessionHistory.tsx`

```typescript
interface SessionRow {
  id: string;
  importType: string;
  status: string;
  recordsCreated: number;
  transactionCount: number;
  createdAt: string;
  yearWarning: boolean;
  isLocked: boolean;
}
```

---

## Data Flow

### Current flow

```
CSV confirm route → write transactions → update ImportSession { status, recordsCreated }
                                                    ↓
                          listImportSessions tRPC → no date range
                                                    ↓
                          ImportSessionHistory dialog → shows "Date" (createdAt only)
```

### Proposed flow

```
CSV confirm route → write transactions
                  → aggregate min/max date from Transaction WHERE importSessionId
                  → update ImportSession { status, recordsCreated, startDate, endDate }
                                                    ↓
                          listImportSessions tRPC → includes startDate / endDate as ISO strings
                                                    ↓
                          ImportSessionHistory dialog → "Coverage" column: "1 Jan – 30 Jun 2025"
```

---

## Constraints and Gotchas

1. **Nullable for legacy / non-CSV imports**: AI image imports (receipts) have scattered dates, not a contiguous period. `startDate`/`endDate` are still populated (min/max of receipt dates) but the "Coverage" label changes to "Date range" for AI imports. For PENDING sessions with no transactions yet, both are `null` — display as "—".

2. **AI import confirm route**: `src/app/api/transactions/ai/confirm/route.ts` should also populate date range if it creates `Transaction` records. Check and add if applicable.

3. **No migration risk**: The new columns are nullable — all existing rows will have `null` values. No data migration needed. Old sessions in the history dialog show "—" for coverage.

4. **Date display locale**: Use `en-AU` locale (`toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })`) consistent with existing `createdAt` display in the table.

5. **Same-day import**: If `startDate === endDate`, show a single date rather than a range.
