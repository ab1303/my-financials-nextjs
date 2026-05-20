# Transaction Clearing (Void & Undo) — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1** | `prisma/schema.prisma`, migration, backfill script | `VOIDED` enums + `IncomeRecord.transactionId` FK |
| **2** | `void.service.ts`, `transaction-clearing.ts` router | Void logic + tRPC surface |
| **3** | `ImportSessionHistory.tsx`, `TransactionsClient.tsx` | Import Session History UI + Undo modal |
| **4** | `TransactionLedgerTable.tsx` | Individual void button in ledger |

---

## Phase 1 — Schema Migration

### Enum changes

```prisma
enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
  VOIDED      // NEW — downstream writes reversed
}

enum ImportStatusEnum {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
  VOIDED      // NEW — entire session reversed
}
```

### `IncomeRecord.transactionId` FK

```prisma
model IncomeRecord {
  // ... existing fields ...
  transaction    Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId  String?      @unique
}

// Back-reference on Transaction:
model Transaction {
  // ... existing fields ...
  incomeRecord   IncomeRecord?
}
```

### Backfill migration

Match existing `IncomeRecord` rows to `Transaction` rows by `(userId via incomeLedger → calendarId, dateEarned, amount)`. Where exact match found, set `incomeRecord.transactionId`. Unmatched records remain with `transactionId = null`.

---

## Phase 2 — Void Service

**File:** `src/server/services/transactions/void.service.ts`

### Reversal logic per status

**DEBIT CONFIRMED → VOIDED:**
1. Find `ExpenseLedger` for `(userId, calendarYear from tx.date)`
2. Find `ExpenseCategory` by name
3. Decrement `MonthlyExpenseSummary.amount`; delete row if result ≤ 0
4. Set `tx.status = VOIDED`, `tx.confirmedAt = null`

**CREDIT CONFIRMED → VOIDED:**
1. Find `IncomeRecord` via `tx.incomeRecord` FK (exact); fallback: match by `(incomeLedgerId, dateEarned, amount)` if `transactionId = null`
2. Delete `IncomeRecord`
3. Set `tx.status = VOIDED`, `tx.confirmedAt = null`

**EXCLUDED → VOIDED:**
1. Set `tx.status = VOIDED` (no downstream to reverse)

### `undoImportSession`

```typescript
export async function undoImportSession(
  prisma: PrismaClient,
  userId: string,
  importSessionId: string,
): Promise<{ voided: number }> {
  return prisma.$transaction(async (db) => {
    const transactions = await db.transaction.findMany({
      where: { importSessionId, userId, status: { not: 'VOIDED' } },
    });

    for (const tx of transactions) {
      await reverseDownstream(db, tx, userId);
    }

    await db.importSession.update({
      where: { id: importSessionId },
      data:  { status: 'VOIDED' },
    });

    return { voided: transactions.length };
  });
}
```

### `voidTransaction`

```typescript
export async function voidTransaction(
  prisma: PrismaClient,
  userId: string,
  transactionId: string,
): Promise<void> {
  return prisma.$transaction(async (db) => {
    const tx = await db.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.userId !== userId) throw new TRPCError({ code: 'NOT_FOUND' });
    if (tx.status === 'VOIDED') return; // idempotent
    await reverseDownstream(db, tx, userId);
  });
}
```

---

## Phase 2 — tRPC Router

**File:** `src/server/api/routers/transaction-clearing.ts`

```typescript
export const transactionClearingRouter = createTRPCRouter({
  undoImportSession: protectedProcedure
    .input(z.object({ importSessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      undoImportSession(ctx.db, ctx.session.user.id, input.importSessionId)),

  voidTransaction: protectedProcedure
    .input(z.object({ transactionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      voidTransaction(ctx.db, ctx.session.user.id, input.transactionId)),

  listImportSessions: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.importSession.findMany({
        where:   { userId: ctx.session.user.id },
        orderBy: { createdAt: 'desc' },
        take:    20,
        include: { _count: { select: { transactions: true } } },
      });
    }),
});
```

---

## Phase 3 — Import Session History UI

**File:** `src/components/transactions/ImportSessionHistory.tsx`

- Calls `api.transactionClearing.listImportSessions.useQuery()`
- Each row: date, file type, records count, status badge
- `COMPLETED`/`PARTIAL` → "Undo" button
- `VOIDED` → "Undone" badge (no action)
- "Undo" opens confirmation modal: "This will reverse X transactions. This cannot be re-done."

---

## Phase 4 — Individual Void in Ledger

In `TransactionLedgerTable.tsx` / `TransactionRow.tsx`:
- Show void icon button on `CONFIRMED` and `EXCLUDED` rows only
- On confirm (popover): calls `api.transactionClearing.voidTransaction.useMutation()`
- Optimistic update: row status changes to `VOIDED` inline
- Voided tab shows all VOIDED rows (read-only, no action)

---

## Future — Gap A: Bulk Reactivation

```typescript
// transaction-clearing.ts router
reactivateImportSession: protectedProcedure
  .input(z.object({ importSessionId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    return reactivateImportSession(ctx.db, ctx.session.user.id, input.importSessionId);
  })
```

Service restores all VOIDED txs to `preVoidStatus ?? 'CONFIRMED'`, re-applies downstream rollup, sets `ImportSession.status → 'COMPLETED'`.

---

## Future — Gap B: Voided Purge

```typescript
purgeVoidedTransactions: protectedProcedure
  .input(z.object({ transactionIds: z.array(z.string().min(1)).min(1) }))
  .mutation(async ({ ctx, input }) => {
    return purgeVoidedTransactions(ctx.db, ctx.session.user.id, input.transactionIds);
  })
```

Blocking rules: live `DonationPayment`, `ReimbursementRecord`, or `IncomeRecord`; non-VOIDED transfer counterpart.

---

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | `VOIDED` enum values; `IncomeRecord.transactionId` FK; Transaction `incomeRecord` back-ref |
| `src/server/services/transactions/void.service.ts` | CREATE | `reverseDownstream`, `undoImportSession`, `voidTransaction` |
| `src/server/api/routers/transaction-clearing.ts` | CREATE | `undoImportSession`, `voidTransaction`, `listImportSessions` procedures |
| `src/server/api/root.ts` | MODIFY | Register `transactionClearing` router |
| `src/components/transactions/ImportSessionHistory.tsx` | CREATE | Import history list with Undo button + confirmation modal |
| `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx` | MODIFY | Render `<ImportSessionHistory>` panel |
| `src/components/transactions/TransactionLedgerTable.tsx` | MODIFY | Voided tab; void icon button per row; optimistic status update |
