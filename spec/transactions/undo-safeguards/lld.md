# Undo Safeguards — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1** | `void-transfer.service.ts`, `void.service.ts`, `transfer.service.ts` | Transfer link cleanup on void |
| **2** | `transaction-clearing.ts` router | Fiscal year warning + lock pre-flight |
| **3** | `prisma/schema.prisma`, `calendar-year.ts` router, settings UI | Fiscal year locking |

---

## Phase 1 — Transfer Link Cleanup

### Architecture Decision

**AD-1: Extract `unlinkTransferPairInTx`**

`unlinkTransferPair()` wraps its own `$transaction`. Nesting inside `undoImportSession`'s transaction would cause a savepoint / potential deadlock. Extract the inner body as `unlinkTransferPairInTx(db, debit, credit, userId)` that accepts a tx-scoped Prisma client.

**AD-2: Within-batch detection**

If both DEBIT and CREDIT of a transfer pair are in the same import session batch, skip counterpart restore — both sides will be voided cleanly. Detect via `sessionTxIds: Set<string>`.

### `void-transfer.service.ts`

```typescript
export async function clearTransferLink(
  db: PrismaTransactionClient,
  tx: Transaction,
  sessionTxIds: Set<string>,
  userId: string,
): Promise<void> {
  const linkedId = tx.transferLinkedTransactionId ?? tx.transferCounterpart?.id;
  if (!linkedId) return; // not linked

  // If counterpart is also in the batch — both going VOIDED, skip restore
  if (sessionTxIds.has(linkedId)) return;

  const counterpart = await db.transaction.findUnique({ where: { id: linkedId } });
  if (!counterpart) return;

  // Determine DEBIT/CREDIT roles
  const debit  = tx.type === 'DEBIT'  ? tx          : counterpart;
  const credit = tx.type === 'CREDIT' ? tx          : counterpart;

  // Restore counterpart to preLinkCategory/preLinkStatus
  await unlinkTransferPairInTx(db, debit, credit, userId);

  // If debit was CONFIRMED before linking (preLinkStatus = CONFIRMED), re-add rollup
  if (debit.preLinkStatus === 'CONFIRMED') {
    await rerollupExpenseSummary({
      userId,
      oldCategory: 'Transfer',
      newCategory: debit.preLinkCategory ?? debit.category,
      amount:      debit.amount,
      date:        debit.date,
    });
  }
}
```

### Modify `void.service.ts`

In `reverseDownstream`, call `clearTransferLink` at the top before the status gate:

```typescript
async function reverseDownstream(
  db: PrismaTransactionClient,
  tx: Transaction,
  userId: string,
  sessionTxIds: Set<string>,
): Promise<void> {
  // NEW: clean up transfer link first
  await clearTransferLink(db, tx, sessionTxIds, userId);

  if (tx.status !== 'CONFIRMED') {
    await db.transaction.update({ where: { id: tx.id }, data: { status: 'VOIDED' } });
    return;
  }
  // ... existing CONFIRMED reversal logic
}
```

---

## Phase 2 — Fiscal Year Warning

### `listImportSessions` enrichment

In `transaction-clearing.ts` router, for each session:

```typescript
// Derive fiscal year from session's transaction dates
const sessionYear = await deriveFiscalYearForSession(ctx.db, session.id, ctx.session.user.id);

const isCurrentYear = sessionYear?.id === currentFiscalYearId;
const yearWarning   = !isCurrentYear && !sessionYear?.lockedAt;
const isLocked      = Boolean(sessionYear?.lockedAt);

// Include in returned row:
{ ...session, yearWarning, isLocked }
```

### `undoImportSession` pre-flight

```typescript
undoImportSession: protectedProcedure
  .input(z.object({ importSessionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const sessionYear = await deriveFiscalYearForSession(ctx.db, input.importSessionId, ctx.session.user.id);

    if (sessionYear?.lockedAt) {
      throw new TRPCError({
        code:    'FORBIDDEN',
        message: 'This import belongs to a locked fiscal year and cannot be undone.',
      });
    }

    return undoImportSession(ctx.db, ctx.session.user.id, input.importSessionId);
  }),
```

### UI changes to `ImportSessionHistory.tsx`

```tsx
{session.isLocked && (
  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Locked</span>
)}
{session.yearWarning && !session.isLocked && (
  <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">⚠️ Previous year</span>
)}
<button
  disabled={session.isLocked || session.status === 'VOIDED'}
  onClick={() => openUndoConfirm(session)}
>
  {session.isLocked ? 'Locked' : 'Undo'}
</button>
```

Undo confirm modal for `yearWarning` rows shows stronger copy: "⚠️ This import is from a previous fiscal year. Are you sure you want to undo it?"

---

## Phase 3 — Fiscal Year Locking

### Schema

```prisma
model CalendarYear {
  // ... all existing fields unchanged ...
  lockedAt  DateTime?   // non-null = user has explicitly locked this fiscal year
}
```

Migration: non-breaking `ALTER TABLE ADD COLUMN "lockedAt" TIMESTAMP`. All existing rows get `NULL` (unlocked).

### `calendar-year.ts` router additions

```typescript
lock: protectedProcedure
  .input(z.object({ calendarYearId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.calendarYear.update({
      where: { id: input.calendarYearId },
      data:  { lockedAt: new Date() },
    });
  }),

unlock: protectedProcedure
  .input(z.object({ calendarYearId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.calendarYear.update({
      where: { id: input.calendarYearId },
      data:  { lockedAt: null },
    });
  }),
```

### Calendar Settings UI

In `src/app/(authorized)/settings/calendar/` — each fiscal year row adds a lock toggle:
- Unlocked → "Lock year" button with warning: "Locking prevents undoing any import from this year."
- Locked → "Locked 🔒" badge + "Unlock" button with warning: "Are you sure? Unlocking allows undo of previous-year imports."

---

## Success Criteria

| # | Criterion | Phase |
|---|---|---|
| 1 | Undoing a session whose txs were transfer-linked to counterparts in other sessions restores those counterparts | 1 |
| 2 | Both sides of transfer pair in same session → both voided cleanly, no counterpart restore errors | 1 |
| 3 | `undoImportSession` response includes `yearWarning: true` for previous-year sessions | 2 |
| 4 | `listImportSessions` returns `yearWarning` and `isLocked` per row | 2 |
| 5 | Import History shows ⚠️ badge and stronger confirm copy for previous-year sessions | 2 |
| 6 | `undoImportSession` throws `FORBIDDEN` for locked-year sessions | 3 |
| 7 | `calendarYear.lock` sets `lockedAt`; `calendarYear.unlock` clears it | 3 |
| 8 | Lock toggle visible in Calendar Settings | 3 |

---

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `lockedAt DateTime?` to `CalendarYear` |
| `src/server/services/transactions/void-transfer.service.ts` | CREATE | `clearTransferLink(db, tx, sessionTxIds, userId)` |
| `src/server/services/transactions/void.service.ts` | MODIFY | Call `clearTransferLink()` in `reverseDownstream()`; pass `sessionTxIds` |
| `src/server/services/transactions/transfer.service.ts` | MODIFY | Extract `unlinkTransferPairInTx(db, debit, credit, userId)` |
| `src/server/api/routers/transaction-clearing.ts` | MODIFY | Enrich `listImportSessions` with `yearWarning`/`isLocked`; add pre-flight to `undoImportSession` |
| `src/server/api/routers/calendar-year.ts` | MODIFY | Add `lock` and `unlock` mutations |
| `src/components/transactions/ImportSessionHistory.tsx` | MODIFY | ⚠️ badge, Locked state, stronger confirm copy |
| `src/app/(authorized)/settings/calendar/` | MODIFY | Lock toggle per fiscal year row with warning copy |
