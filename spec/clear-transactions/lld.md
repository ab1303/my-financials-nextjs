# Clear Transactions — Low Level Design

---

## Phase 1 — Schema Migration & IncomeRecord FK Fix

### 1.1 Prisma schema changes

**File:** `prisma/schema.prisma`

#### Change 1 — `TransactionStatusEnum`
```prisma
// BEFORE:
enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
}

// AFTER:
enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
  VOIDED
}
```

#### Change 2 — `ImportStatusEnum`
```prisma
// BEFORE:
enum ImportStatusEnum {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
}

// AFTER:
enum ImportStatusEnum {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
  VOIDED
}
```

#### Change 3 — `IncomeRecord` model (add `transactionId`)
```prisma
model IncomeRecord {
  id             String               @id @default(cuid())
  dateEarned     DateTime
  amount         Decimal              @db.Money
  source         IncomeSourceEnumType
  incomeLedger   IncomeLedger         @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId String
  transaction    Transaction?         @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId  String?              @unique    // ← NEW
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([incomeLedgerId, dateEarned])
}
```

#### Change 4 — `Transaction` model (add back-reference)
```prisma
model Transaction {
  // ... all existing fields ...
  incomeRecord   IncomeRecord?    // ← NEW back-ref (zero or one)
}
```

### 1.2 Migration command
```bash
pnpm prisma migrate dev --name add_voided_status_and_income_record_transaction_fk
```

> ⚠️ Stop the dev server before running this command (Windows EPERM prevention).

### 1.3 Backfill script

**File:** `scripts/backfill-income-record-transaction-id.ts`

Run once after migration to link existing `IncomeRecord` rows to `Transaction` rows.

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Load all IncomeRecords that have no transactionId yet
  const orphaned = await prisma.incomeRecord.findMany({
    where: { transactionId: null },
    include: {
      incomeLedger: {
        include: { calendar: true },
      },
    },
  });

  console.log(`Found ${orphaned.length} unlinked IncomeRecords`);
  let linked = 0;
  let skipped = 0;

  for (const record of orphaned) {
    const userId = record.incomeLedger.userId;

    // Find a CONFIRMED CREDIT Transaction matching by userId, date, amount
    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'CREDIT',
        status: 'CONFIRMED',
        date: record.dateEarned,
        amount: record.amount,
        incomeRecord: null,   // not yet claimed
      },
    });

    if (candidates.length === 1) {
      await prisma.incomeRecord.update({
        where: { id: record.id },
        data: { transactionId: candidates[0]!.id },
      });
      linked++;
    } else {
      // 0 candidates = pre-Transaction data; >1 = ambiguous duplicate amounts on same day
      console.warn(
        `Skipped IncomeRecord ${record.id}: ${candidates.length} candidates (userId=${userId}, date=${record.dateEarned.toISOString()}, amount=${record.amount})`
      );
      skipped++;
    }
  }

  console.log(`Linked: ${linked}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run with:
```bash
pnpm tsx scripts/backfill-income-record-transaction-id.ts
```

---

## Phase 2 — Void Service & tRPC Router

### 2.1 Void service

**File to create:** `src/server/services/transactions/void.service.ts`

```typescript
import { PrismaClient, TransactionStatusEnum } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

const TERMINAL_STATUSES: TransactionStatusEnum[] = ['VOIDED'];

interface VoidContext {
  prisma: PrismaClient;
  userId: string;
}

// ─── Single transaction void ───────────────────────────────────────────────

export async function voidSingleTransaction(
  ctx: VoidContext,
  transactionId: string
): Promise<void> {
  const tx = await ctx.prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { incomeRecord: true },
  });

  if (!tx || tx.userId !== ctx.userId) {
    throw new Error('Transaction not found');
  }
  if (TERMINAL_STATUSES.includes(tx.status)) {
    return; // idempotent — already voided
  }

  await ctx.prisma.$transaction(async (db) => {
    await reverseDownstream(db as PrismaClient, ctx.userId, tx);
    await db.transaction.update({
      where: { id: transactionId },
      data: { status: 'VOIDED', confirmedAt: null },
    });
  });
}

// ─── Import session undo ───────────────────────────────────────────────────

export async function undoImportSession(
  ctx: VoidContext,
  importSessionId: string
): Promise<{ voided: number }> {
  const session = await ctx.prisma.importSession.findUnique({
    where: { id: importSessionId },
    include: {
      transactions: {
        where: { userId: ctx.userId, status: { not: 'VOIDED' } },
        include: { incomeRecord: true },
      },
    },
  });

  if (!session || session.userId !== ctx.userId) {
    throw new Error('Import session not found');
  }
  if (session.status === 'VOIDED') {
    return { voided: 0 }; // idempotent
  }

  const txs = session.transactions;

  await ctx.prisma.$transaction(async (db) => {
    for (const tx of txs) {
      await reverseDownstream(db as PrismaClient, ctx.userId, tx);
    }

    // Bulk update all transactions in this session to VOIDED
    await db.transaction.updateMany({
      where: { importSessionId, userId: ctx.userId, status: { not: 'VOIDED' } },
      data: { status: 'VOIDED', confirmedAt: null },
    });

    await db.importSession.update({
      where: { id: importSessionId },
      data: { status: 'VOIDED' },
    });
  });

  return { voided: txs.length };
}

// ─── Reversal logic ────────────────────────────────────────────────────────

async function reverseDownstream(
  db: PrismaClient,
  userId: string,
  tx: {
    id: string;
    type: string;
    status: string;
    amount: Decimal;
    date: Date;
    category: string;
    incomeRecord: { id: string } | null;
  }
): Promise<void> {
  if (tx.status === 'CONFIRMED') {
    if (tx.type === 'DEBIT') {
      await reverseExpenseSummary(db, userId, tx.amount, tx.date, tx.category);
    } else if (tx.type === 'CREDIT') {
      await reverseIncomeRecord(db, userId, tx.amount, tx.date, tx.incomeRecord?.id);
    }
  }
  // EXCLUDED → no downstream to reverse
}

async function reverseExpenseSummary(
  db: PrismaClient,
  userId: string,
  amount: Decimal,
  date: Date,
  category: string
): Promise<void> {
  const monthNum = date.getMonth() + 1;

  const calendar = await db.calendarYear.findFirst({
    where: {
      type: 'FISCAL',
      OR: [
        { fromYear: date.getFullYear(), fromMonth: { lte: monthNum } },
        { toYear: date.getFullYear(), toMonth: { gte: monthNum } },
      ],
    },
  });
  if (!calendar) return; // no calendar = nothing to reverse

  const ledger = await db.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendar.id, userId } },
  });
  if (!ledger) return;

  const expenseCat = await db.expenseCategory.findFirst({
    where: { name: category, isActive: true },
  });
  if (!expenseCat) return;

  const summary = await db.monthlyExpenseSummary.findFirst({
    where: { expenseLedgerId: ledger.id, categoryId: expenseCat.id, month: monthNum },
  });
  if (!summary) return;

  const newAmount = Number(summary.amount) - Number(amount);
  if (newAmount <= 0) {
    await db.monthlyExpenseSummary.delete({ where: { id: summary.id } });
  } else {
    await db.monthlyExpenseSummary.update({
      where: { id: summary.id },
      data: { amount: { decrement: amount } },
    });
  }
}

async function reverseIncomeRecord(
  db: PrismaClient,
  userId: string,
  amount: Decimal,
  date: Date,
  incomeRecordId: string | undefined
): Promise<void> {
  if (incomeRecordId) {
    // Exact match via FK (post-backfill)
    await db.incomeRecord.delete({ where: { id: incomeRecordId } });
    return;
  }

  // Fallback: fuzzy match for pre-backfill records (best-effort)
  const calendar = await db.calendarYear.findFirst({
    where: {
      type: 'FISCAL',
      OR: [
        { fromYear: date.getFullYear(), fromMonth: { lte: date.getMonth() + 1 } },
        { toYear: date.getFullYear(), toMonth: { gte: date.getMonth() + 1 } },
      ],
    },
  });
  if (!calendar) return;

  const ledger = await db.incomeLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendar.id, userId } },
  });
  if (!ledger) return;

  const record = await db.incomeRecord.findFirst({
    where: { incomeLedgerId: ledger.id, dateEarned: date, amount: String(amount) },
  });
  if (record) {
    await db.incomeRecord.delete({ where: { id: record.id } });
  }
}
```

### 2.2 tRPC router

**File to create:** `src/server/api/routers/transaction-clearing.ts`

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { voidSingleTransaction, undoImportSession } from '@/server/services/transactions/void.service';

export const transactionClearingRouter = createTRPCRouter({

  undoImportSession: protectedProcedure
    .input(z.object({ importSessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await undoImportSession(
          { prisma: ctx.db, userId: ctx.session.user.id },
          input.importSessionId
        );
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Undo failed',
        });
      }
    }),

  voidTransaction: protectedProcedure
    .input(z.object({ transactionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await voidSingleTransaction(
          { prisma: ctx.db, userId: ctx.session.user.id },
          input.transactionId
        );
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Void failed',
        });
      }
    }),

  // Query: list import sessions with transaction counts for the history panel
  listImportSessions: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const sessions = await ctx.db.importSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          _count: { select: { transactions: true } },
        },
      });
      return sessions.map((s) => ({
        id:           s.id,
        importType:   s.importType,
        status:       s.status,
        recordsCreated: s.recordsCreated,
        transactionCount: s._count.transactions,
        createdAt:    s.createdAt.toISOString(),
      }));
    }),
});
```

**File to modify:** `src/server/api/root.ts`
```typescript
import { transactionClearingRouter } from '@/server/api/routers/transaction-clearing';
// add to appRouter:
transactionClearing: transactionClearingRouter,
```

---

## Phase 3 — Import Session History UI

### 3.1 Component

**File to create:** `src/components/transactions/ImportSessionHistory.tsx`

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/utils/api';
import { toast } from 'sonner';

export default function ImportSessionHistory() {
  const { data, refetch, isLoading } = api.transactionClearing.listImportSessions.useQuery({ limit: 20 });
  const undoMutation = api.transactionClearing.undoImportSession.useMutation({
    onSuccess: (result) => {
      toast.success(`Undone — ${result.voided} transactions reversed`);
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const pendingSession = data?.find((s) => s.id === confirmId);

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Import History</h2>

      {/* Confirmation modal */}
      {confirmId && pendingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">Undo Import?</h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              This will reverse {pendingSession.transactionCount} transactions and remove their financial records.
              <strong className="block mt-2 text-red-600 dark:text-red-400">This action cannot be re-done.</strong>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  undoMutation.mutate({ importSessionId: confirmId });
                  setConfirmId(null);
                }}
                disabled={undoMutation.isPending}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Yes, Undo Import
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {data && data.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No imports yet.</p>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Date', 'Type', 'Records', 'Status', ''].map((h) => (
                  <th key={h} className="select-none cursor-default px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.map((session) => (
                <tr key={session.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(session.createdAt).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {session.importType === 'EXPENSE' ? 'CSV' : session.importType}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {session.transactionCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(session.status === 'COMPLETED' || session.status === 'PARTIAL') && (
                      <button
                        onClick={() => setConfirmId(session.id)}
                        className="rounded px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Undo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    PARTIAL:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    VOIDED:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    FAILED:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    PROCESSING:'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    PENDING:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
```

### 3.2 Wire into `TransactionsClient`

**File to modify:** `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx`

Add below the import cards section:
```typescript
import ImportSessionHistory from '@/components/transactions/ImportSessionHistory';

// Inside JSX, after import card grid:
<ImportSessionHistory />
```

---

## Phase 4 — Individual Void Button in Ledger Table

### 4.1 Void button component

**File to create:** `src/components/transactions/VoidTransactionButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { MdOutlineCancel } from 'react-icons/md';
import { api } from '@/utils/api';
import { toast } from 'sonner';

interface Props {
  transactionId: string;
  onVoided: () => void;
}

export default function VoidTransactionButton({ transactionId, onVoided }: Props) {
  const [open, setOpen] = useState(false);

  const mutation = api.transactionClearing.voidTransaction.useMutation({
    onSuccess: () => {
      toast.success('Transaction voided');
      setOpen(false);
      onVoided();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <button
        aria-label="Void transaction"
        onClick={() => setOpen(true)}
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      >
        <MdOutlineCancel size={16} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800">
            <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
              Void this transaction? Its financial records will be reversed.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400">
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate({ transactionId })}
                disabled={mutation.isPending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Void
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### 4.2 Add to `TransactionLedgerTable`

In `src/components/transactions/TransactionLedgerTable.tsx`:

- Add `Actions` column header to table head
- In each row: render `<VoidTransactionButton>` only when `transaction.status !== 'VOIDED'`
- Pass `onVoided={() => refetch()}` to trigger ledger refresh
- In the tab filter map, add:
  ```typescript
  const TAB_TO_PARAMS = {
    // ... existing tabs ...
    voided: { status: 'VOIDED' as TransactionStatusEnum },
  };
  ```
- Add `'voided'` to the `TabFilter` type and render a "Voided" tab

---

## Implementation Order

1. **Phase 1** — Schema migration + backfill script *(prerequisite for all else)*
2. **Phase 2** — `void.service.ts` + `transactionClearing` tRPC router
3. **Phase 3** — `ImportSessionHistory` component + wire into `TransactionsClient`
4. **Phase 4** — `VoidTransactionButton` + `TransactionLedgerTable` void column + Voided tab

Phases 3 and 4 require the Transaction Ledger table (from `spec/transaction-ledger`) to be implemented first.
