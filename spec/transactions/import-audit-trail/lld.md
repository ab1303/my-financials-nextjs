# Import Audit Trail — Low-Level Design

## Phase Map

| Phase                | Files Changed/Created                                                                 | Description                                                      |
|----------------------|--------------------------------------------------------------------------------------|------------------------------------------------------------------|
| 1. Import History    | src/components/transactions/ImportSessionHistory.tsx (MODIFY)                        | Show skipped count, add validation review modal trigger           |
| 2. Ledger Source     | src/components/transactions/TransactionLedgerTable.tsx (MODIFY)                      | Add import source column/badge                                   |
| 3. Validation Modal  | src/components/transactions/ImportValidationReview.tsx (CREATE)                      | Modal to review details before undo                              |
| 4. tRPC Query/Service| src/server/trpc/router/transaction-clearing.ts (MODIFY), src/server/services/transactions/import-audit.service.ts (CREATE) | Add getImportSessionDetails query, helper for import metadata     |
| 5. Ledger API        | src/server/trpc/router/transaction-ledger.ts (MODIFY)                                | Add importSource to transaction response (if not present)        |

## File Inventory

| File Path                                                                 | Action  | Description                                      |
|--------------------------------------------------------------------------|---------|--------------------------------------------------|
| src/components/transactions/ImportSessionHistory.tsx                      | MODIFY  | Show skipped count, add validation review modal   |
| src/components/transactions/TransactionLedgerTable.tsx                    | MODIFY  | Add import source column/badge                   |
| src/components/transactions/ImportValidationReview.tsx                    | CREATE  | Modal to review details before undo              |
| src/server/trpc/router/transaction-clearing.ts                            | MODIFY  | Add getImportSessionDetails query                |
| src/server/services/transactions/import-audit.service.ts                  | CREATE  | Helper to fetch import metadata                  |
| src/server/trpc/router/transaction-ledger.ts                              | MODIFY  | Add importSource to transaction response         |

## Phase 1: Import History (Skipped Count, Validation Review)

### TypeScript Interfaces

```ts
export interface ImportSessionDetail {
  id: string;
  userId: string;
  importType: string;
  status: string;
  recordsCreated: number;
  skippedCount: number;
  metadata?: any;
  startDate?: string;
  endDate?: string;
  transactions: TransactionSummary[];
}

export interface TransactionSummary {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
  importSessionId?: string;
}

export interface SkippedTransactionInfo {
  id: string;
  reason: string;
}
```

### Zod Schemas

```ts
import { z } from 'zod';

export const SkippedTransactionInfoSchema = z.object({
  id: z.string(),
  reason: z.string(),
});

export const TransactionSummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  status: z.string(),
  importSessionId: z.string().optional(),
});

export const ImportSessionDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  importType: z.string(),
  status: z.string(),
  recordsCreated: z.number(),
  skippedCount: z.number(),
  metadata: z.any().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  transactions: z.array(TransactionSummarySchema),
});
```

### Function Signatures

```ts
// src/server/services/transactions/import-audit.service.ts
export async function getImportSessionDetails(sessionId: string, userId: string): Promise<ImportSessionDetail>;

// src/server/trpc/router/transaction-clearing.ts
getImportSessionDetails: t.procedure.input(z.object({ sessionId: z.string() })).query(async ({ input, ctx }) => { ... });
```

### TDD Test Cases

| Test                                         | Type      | Verifies                                                      |
|----------------------------------------------|-----------|---------------------------------------------------------------|
| Returns correct skipped count                | Unit      | Skipped transactions are counted and returned                  |
| Returns all transactions for session         | Unit      | All transactions linked to sessionId are included              |
| Handles missing/invalid sessionId gracefully | Unit      | Returns error or empty result for invalid sessionId            |
| Modal displays correct transaction list      | Integration| UI shows correct transactions in validation review modal       |
| Undo import only voids correct transactions  | Integration| Only transactions from session are voided on undo              |

### Integration Points & Edge Cases

- Ensure only transactions with matching `importSessionId` are included
- Skipped transactions must be clearly separated from imported
- Handle sessions with zero skipped or zero imported records
- UI must handle large import sessions efficiently
- Undo must not affect transactions from other sessions

## Migration Notes

- No schema changes or migrations required for Phase 1
- `importSessionId` FK already exists on `Transaction`
