# Undo Safeguards — Low Level Design

---

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| **Phase 1** | `void-transfer.service.ts` (new), `void.service.ts`, `transfer.service.ts` | Transfer link cleanup during void |
| **Phase 2** | `transaction-clearing.ts`, `ImportSessionHistory.tsx` | Fiscal year warnings in undo flow (no schema change) |
| **Phase 3** | `schema.prisma`, `calendar-year` router, calendar settings UI | Explicit fiscal year locking with hard block |

---

## Phase 1 — Transfer Link Cleanup

### Problem Recap

When voiding transaction T:
- If T is the **DEBIT side** (`T.transferLinkedTransactionId` is non-null) → the CREDIT counterpart
  (whose id = `T.transferLinkedTransactionId`) remains EXCLUDED/Transfer with stale preLinkCategory/Status.
- If T is the **CREDIT side** (some DEBIT has `transferLinkedTransactionId = T.id`) → that DEBIT
  remains EXCLUDED/Transfer with a dangling FK.

### New File: `void-transfer.service.ts`

```typescript
import type { PrismaClient, TransactionStatusEnum } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { rerollupExpenseSummary } from './ledger.service';
import { TRANSFER_CATEGORY } from './constants';

/**
 * Clear transfer link on both sides of a pair when one side is being voided.
 * Must be called inside an existing prisma.$transaction block.
 *
 * @param db         - transaction-scoped Prisma client
 * @param userId     - scoped to prevent cross-user access
 * @param tx         - the transaction being voided (minimal shape required)
 * @param sessionTxIds - IDs of ALL transactions being voided in this batch
 *                       (used to skip counterpart restore when both sides are in the same batch)
 */
export async function clearTransferLink(
  db: PrismaClient,
  userId: string,
  tx: {
    id: string;
    transferLinkedTransactionId: string | null;
    preLinkCategory: string | null;
    preLinkStatus: TransactionStatusEnum | null;
  },
  sessionTxIds: Set<string>,
): Promise<void> {
  if (tx.transferLinkedTransactionId) {
    // This tx is the DEBIT side — it stores the FK
    await _clearDebitSide(db, userId, tx, sessionTxIds);
  } else {
    // This tx might be the CREDIT side — search for the DEBIT that links to it
    await _clearCreditSide(db, userId, tx.id, sessionTxIds);
  }
}

async function _clearDebitSide(
  db: PrismaClient,
  userId: string,
  debit: {
    id: string;
    transferLinkedTransactionId: string;
    preLinkCategory: string | null;
    preLinkStatus: TransactionStatusEnum | null;
  },
  sessionTxIds: Set<string>,
): Promise<void> {
  // Clear the FK on the DEBIT itself (it's being voided; updateMany only sets status/confirmedAt)
  await (db.transaction as any).update({
    where: { id: debit.id },
    data: { transferLinkedTransactionId: null, preLinkCategory: null, preLinkStatus: null },
  });

  // Restore the CREDIT counterpart only if it is NOT also being voided in this batch
  if (sessionTxIds.has(debit.transferLinkedTransactionId)) return;

  const credit = await (db.transaction as any).findUnique({
    where: { id: debit.transferLinkedTransactionId },
    select: { id: true, preLinkCategory: true, preLinkStatus: true, category: true, status: true },
  });
  if (!credit || credit.status === 'VOIDED') return;

  await (db.transaction as any).update({
    where: { id: credit.id },
    data: {
      category: credit.preLinkCategory ?? credit.category,
      status: credit.preLinkStatus ?? credit.status,
      preLinkCategory: null,
      preLinkStatus: null,
    },
  });
}

async function _clearCreditSide(
  db: PrismaClient,
  userId: string,
  creditId: string,
  sessionTxIds: Set<string>,
): Promise<void> {
  const debit = await (db.transaction as any).findFirst({
    where: { transferLinkedTransactionId: creditId },
    select: {
      id: true,
      preLinkCategory: true,
      preLinkStatus: true,
      category: true,
      status: true,
      amount: true,
      date: true,
    },
  });
  if (!debit) return; // Not linked as a transfer credit

  const restoredCategory = debit.preLinkCategory ?? debit.category;
  const restoredStatus   = debit.preLinkStatus   ?? debit.status;

  // If the DEBIT is also in this batch, just clear its FK — it will be voided too
  if (sessionTxIds.has(debit.id)) {
    await (db.transaction as any).update({
      where: { id: debit.id },
      data: { transferLinkedTransactionId: null, preLinkCategory: null, preLinkStatus: null },
    });
    return;
  }

  // DEBIT is from a different session — restore it fully
  await (db.transaction as any).update({
    where: { id: debit.id },
    data: {
      transferLinkedTransactionId: null,
      category: restoredCategory,
      status: restoredStatus,
      preLinkCategory: null,
      preLinkStatus: null,
    },
  });

  // If the DEBIT was previously CONFIRMED, re-add its amount to the expense summary
  if (debit.preLinkStatus === 'CONFIRMED' && restoredCategory !== TRANSFER_CATEGORY) {
    await rerollupExpenseSummary({
      prismaClient: db,
      userId,
      oldCategory: TRANSFER_CATEGORY,
      newCategory: restoredCategory,
      amount: debit.amount,
      date: debit.date,
    });
  }

  // Clear pre-link metadata on the CREDIT (it's being voided; final status set by updateMany)
  await (db.transaction as any).update({
    where: { id: creditId },
    data: { preLinkCategory: null, preLinkStatus: null },
  });
}
```

### Changes to `void.service.ts`

**In `undoImportSession`:** build `sessionTxIds` before the loop and pass it through.

```typescript
// Existing include — add transferLinkedTransactionId (scalar, already present)
// Add to include: donationPayment already added; no new include needed for transfer (scalar fields)

const sessionTxIds = new Set(txs.map((t) => t.id));

await ctx.prisma.$transaction(async (db) => {
  for (const tx of txs) {
    await clearTransferLink(db as unknown as PrismaClient, ctx.userId, tx, sessionTxIds); // NEW
    await reverseDownstream(db as unknown as PrismaClient, ctx.userId, tx);
  }
  // ... updateMany + session update unchanged ...
});
```

**In `voidSingleTransaction`:** pass a single-element set.

```typescript
await ctx.prisma.$transaction(async (db) => {
  await clearTransferLink(db as unknown as PrismaClient, ctx.userId, tx, new Set([tx.id])); // NEW
  await reverseDownstream(db as unknown as PrismaClient, ctx.userId, tx);
  await db.transaction.update({ where: { id: transactionId }, data: { status: 'VOIDED', confirmedAt: null } });
});
```

### Phase 1 Test Cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | Undo session with DEBIT that has `transferLinkedTransactionId` pointing to CREDIT in another session → CREDIT restored to preLinkCategory/preLinkStatus | Unit | `_clearDebitSide` restores counterpart |
| 2 | Undo session with CREDIT that was the counterpart of a DEBIT in another session → DEBIT restored, expense rollup re-added if DEBIT was CONFIRMED | Unit | `_clearCreditSide` restores DEBIT + triggers `rerollupExpenseSummary` |
| 3 | Undo session containing BOTH sides of a transfer pair → both are voided cleanly, no restore errors, no duplicate `rerollupExpenseSummary` | Unit | `sessionTxIds` correctly skips cross-restore |
| 4 | Undo session with DEBIT that has `transferLinkedTransactionId` but counterpart is already VOIDED → no-op, no error | Unit | `credit.status === 'VOIDED'` guard |
| 5 | Undo session with no transfer links → `clearTransferLink` completes without DB writes | Unit | Happy path for non-linked transactions |
| 6 | `voidSingleTransaction` on a DEBIT linked to a CREDIT → CREDIT is restored | Integration | End-to-end single void |

---

## Phase 2 — Fiscal Year Warnings

### Changes to `listImportSessions`

Add fiscal year derivation per session row. No schema migration required — uses existing
`CalendarYear` data.

```typescript
// Return type additions
interface ImportSessionRow {
  id: string;
  importType: string;
  status: string;
  recordsCreated: number;
  transactionCount: number;
  createdAt: string;
  yearWarning: boolean;   // true if session spans a previous (unlocked) fiscal year
  isLocked: boolean;      // true if session spans a locked fiscal year
}
```

**Server logic sketch:**

```typescript
// After fetching sessions, for each session fetch the min/max transaction date
// and check against CalendarYear table
async function deriveYearFlags(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  sessionCreatedAt: Date,
): Promise<{ yearWarning: boolean; isLocked: boolean }> {
  // Find the fiscal year that contains sessionCreatedAt
  const fiscal = await prisma.calendarYear.findFirst({
    where: {
      userId,
      type: 'FISCAL',
      OR: [
        { fromYear: sessionCreatedAt.getFullYear(), fromMonth: { lte: sessionCreatedAt.getMonth() + 1 } },
        { toYear: sessionCreatedAt.getFullYear(), toMonth: { gte: sessionCreatedAt.getMonth() + 1 } },
      ],
    },
  });

  if (!fiscal) return { yearWarning: false, isLocked: false };

  // Determine if this is a "past" fiscal year (toYear/toMonth is in the past)
  const now = new Date();
  const yearEnded = fiscal.toYear < now.getFullYear() ||
    (fiscal.toYear === now.getFullYear() && fiscal.toMonth < now.getMonth() + 1);

  return {
    isLocked: fiscal.lockedAt != null,          // Phase 3: field not yet on model
    yearWarning: yearEnded && !fiscal.lockedAt,  // past but unlocked → warn
  };
}
```

> **Note:** `fiscal.lockedAt` does not exist until Phase 3. In Phase 2, `isLocked` always returns
> `false` and `yearWarning` is purely time-based (past fiscal year).

### Changes to `undoImportSession`

```typescript
// Pre-flight check (Phase 2: warning only; Phase 3: hard block on lockedAt)
const { yearWarning, isLocked } = await deriveYearFlags(ctx.prisma, userId, session.id, session.createdAt);

if (isLocked) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'This import belongs to a locked fiscal year and cannot be undone.',
  });
}

// Proceed with undo; return yearWarning in result
return { voided: txs.length, yearWarning };
```

### Changes to `ImportSessionHistory.tsx`

```typescript
// Session row shape (extended)
interface SessionRow {
  // ... existing fields ...
  yearWarning: boolean;
  isLocked: boolean;
}

// Render year warning badge
{session.yearWarning && (
  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
    <AlertTriangle className="h-3 w-3" /> Previous year
  </span>
)}

// Undo confirm message (extended when yearWarning)
message={session.yearWarning
  ? `This import is from a previous fiscal year. Undoing it will reverse ${session.transactionCount} transactions and remove associated financial records that may have been used for tax reporting. This cannot be re-done.`
  : `This will void all ${session.transactionCount} transactions from this import and reverse their expense summaries and income records. This cannot be re-done.`
}

// Locked state
{session.isLocked && (
  <span className="rounded px-3 py-1 text-xs font-medium text-muted-foreground cursor-not-allowed" title="This fiscal year is locked">
    Locked
  </span>
)}
```

### Phase 2 Test Cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | `listImportSessions` returns `yearWarning: true` for a session whose `createdAt` falls in a previous fiscal year | Unit | `deriveYearFlags` date comparison logic |
| 2 | `listImportSessions` returns `yearWarning: false` for a session in the current fiscal year | Unit | Current-year sessions are not flagged |
| 3 | `undoImportSession` succeeds but returns `{ yearWarning: true }` for a previous-year session | Unit | Pre-flight allows undo but enriches response |
| 4 | `undoImportSession` throws `FORBIDDEN` when `isLocked: true` (Phase 3 prerequisite) | Unit | Lock enforcement gate |
| 5 | UI shows ⚠️ badge for `yearWarning` rows | Component | Badge render condition |
| 6 | Undo confirm copy includes "fiscal year" warning text when `yearWarning` is true | Component | Conditional message copy |

---

## Phase 3 — Fiscal Year Locking

### Schema Migration

```prisma
model CalendarYear {
  // ... all existing fields unchanged ...

  lockedAt  DateTime?  // non-null = user has explicitly locked this fiscal year
}
```

Migration: `ALTER TABLE "CalendarYear" ADD COLUMN "lockedAt" TIMESTAMP(3)`.
Safe non-breaking change — all existing rows are `NULL` (unlocked).

### tRPC Procedures (calendar-year router)

```typescript
lockYear: protectedProcedure
  .input(z.object({ calendarYearId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const year = await ctx.prisma.calendarYear.findUnique({ where: { id: input.calendarYearId } });
    if (!year || year.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
    return ctx.prisma.calendarYear.update({
      where: { id: input.calendarYearId },
      data: { lockedAt: new Date() },
    });
  }),

unlockYear: protectedProcedure
  .input(z.object({ calendarYearId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const year = await ctx.prisma.calendarYear.findUnique({ where: { id: input.calendarYearId } });
    if (!year || year.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
    return ctx.prisma.calendarYear.update({
      where: { id: input.calendarYearId },
      data: { lockedAt: null },
    });
  }),
```

### Calendar Settings UI Changes

Add a lock toggle to each fiscal year row in `src/app/(authorized)/settings/calendar/`:

```typescript
// Lock state badge + toggle button
{year.lockedAt ? (
  <div className="flex items-center gap-2">
    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <Lock className="h-3 w-3" /> Locked {format(year.lockedAt, 'dd MMM yyyy')}
    </span>
    <button onClick={() => handleUnlock(year.id)} className="text-xs text-muted-foreground underline hover:text-foreground">
      Unlock
    </button>
  </div>
) : (
  <button onClick={() => handleLock(year.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-600">
    <Lock className="h-3 w-3" /> Lock year
  </button>
)}
```

Unlock must show a `ConfirmationDialog` with `variant="warning"`:
> "Unlocking this year will allow import history to be undone. Only do this if you are correcting
> a genuine error in a previously filed period."

### Phase 3 Test Cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | `calendarYear.lock` sets `lockedAt` to current timestamp | Unit | Mutation writes correct field |
| 2 | `calendarYear.unlock` clears `lockedAt` to null | Unit | Unlock mutation |
| 3 | `undoImportSession` throws `FORBIDDEN` for session in a locked fiscal year | Unit | Hard block enforcement |
| 4 | `undoImportSession` succeeds for session in an unlocked previous year (yearWarning but no block) | Unit | Soft vs hard distinction |
| 5 | Calendar settings renders Lock button for unlocked years, Locked badge for locked years | Component | UI state rendering |
| 6 | Unlock confirm dialog is shown before `unlockYear` is called | Component | Safety gate for unlock action |

---

## Integration Points and Edge Cases

| Edge Case | Handling |
|---|---|
| Session spans two fiscal years (e.g. Dec 2024 → Jan 2025 import) | Flag as `yearWarning` if the *earlier* fiscal year is in the past; flag `isLocked` if *either* spanned year is locked |
| No `CalendarYear` configured for user | `deriveYearFlags` returns `{ yearWarning: false, isLocked: false }` — no false positives |
| Transfer counterpart is from a different user (should never happen — data model guards this) | Guard `userId` in all `db.transaction.findUnique/findFirst` where clauses |
| `preLinkCategory` is null (edge: linked before preLinkCategory was stored) | Fall through to `debit.category` (current category, likely 'Transfer') — no restore attempted; transfer stays cleared |
| Transfer-linked tx is VOIDED before session undo (e.g. individually voided) | `credit.status === 'VOIDED'` guard in `_clearDebitSide` — skip silently |
| `rerollupExpenseSummary` fails (missing CalendarYear/Ledger) | Swallow silently or log; do not abort the entire undo — same pattern as existing `reverseExpenseSummary` |
