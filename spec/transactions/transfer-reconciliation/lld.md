# Transfer Reconciliation — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1A** | `csv-classifier.service.ts`, `csv-confirm.service.ts`, `constants.ts` | Add `'Transfer'` to debit LLM prompt; skip rollup for transfer debits |
| **1B** | `prisma/schema.prisma`, migration, `transfer.service.ts`, `transfer.ts` router, `_types.ts` | Schema fields + Transfer service + tRPC router (no UI) |
| **2** | `transaction-ledger.ts`, `TransactionLedgerTable.tsx`, `TransferLinkDrawer.tsx`, `UnmatchedTransfersBadge.tsx` | Transfer linking UI in transaction ledger |

---

## Phase 1B — Schema Changes

```prisma
model Transaction {
  // ... all existing fields ...
  transferLinkedTransactionId  String?                @unique
  transferLinkedTransaction    Transaction?           @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
  transferCounterpart          Transaction?           @relation("TransferLink")
  preLinkCategory              String?
  preLinkStatus                TransactionStatusEnum?
}
```

Migration SQL:
```sql
ALTER TABLE "Transaction" ADD COLUMN "transferLinkedTransactionId" TEXT UNIQUE;
ALTER TABLE "Transaction" ADD COLUMN "preLinkCategory" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "preLinkStatus" "TransactionStatusEnum";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferLinkedTransactionId_fkey"
  FOREIGN KEY ("transferLinkedTransactionId") REFERENCES "Transaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## Phase 1B — Types

**File:** `src/server/services/transactions/_types.ts`

```typescript
export interface TransferCandidateScore {
  transactionId: string;
  bankAccountId: string;
  bankAccountName: string;
  bankName: string | null;
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  status: TransactionStatusEnum;
  confidenceScore: number; // 0–100
  scoreBreakdown: {
    amountMatch: number;           // 0–40
    dateProximity: number;         // 0–30
    descriptionSimilarity: number; // 0–20
    sameBankBonus: number;         // 0–10
  };
  amountDiffWarning: string | null;
}

export interface TransferLinkResult {
  debitTransactionId:  string;
  creditTransactionId: string;
  linkedAt:            Date;
  rollupReversed:      boolean;
  incomeRecordDeleted: boolean;
}

export interface TransferUnlinkResult {
  debitTransactionId:    string;
  creditTransactionId:   string;
  restoredDebitCategory: string;
  restoredDebitStatus:   TransactionStatusEnum;
  rollupRestored:        boolean;
}
```

---

## Phase 1B — Transfer Service

**File:** `src/server/services/transactions/transfer.service.ts`

Key functions:

```typescript
export async function getCandidates(
  userId: string,
  sourceTransactionId: string,
): Promise<TransferCandidateScore[]>
// - Fetches unlinked Transfer transactions for the user
// - Scores each candidate 0–100 using amountMatch, dateProximity, descriptionSimilarity, sameBankBonus
// - Returns sorted by score DESC; excludes same account

export async function linkTransferPair(
  userId: string,
  debitId: string,
  creditId: string,
): Promise<TransferLinkResult>
// - Validates both belong to user, both are unlinked
// - Stores preLinkCategory + preLinkStatus on both
// - Sets transferLinkedTransactionId on DEBIT
// - If DEBIT was CONFIRMED: calls rerollupExpenseSummary(newCategory: 'Transfer') to reverse rollup
// - If CREDIT was CONFIRMED: deletes IncomeRecord (was mis-classified income)
// - Runs inside prisma.$transaction

export async function unlinkTransferPair(
  userId: string,
  transactionId: string,
): Promise<TransferUnlinkResult>
// - Finds DEBIT by transferLinkedTransactionId or its counterpart
// - Restores both preLinkCategory and preLinkStatus
// - Re-applies rollup if debit was CONFIRMED
// - Clears transferLinkedTransactionId + preLinkCategory + preLinkStatus
```

Scoring constants:
```typescript
export const TRANSFER_DATE_TOLERANCE_DAYS = 5;
export const TRANSFER_AMOUNT_FEE_TOLERANCE = 10; // dollars — flag as warning, not rejection
```

---

## Phase 1B — tRPC Router

**File:** `src/server/api/routers/transfer.ts`

```typescript
export const transferRouter = createTRPCRouter({
  getCandidates: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .query(async ({ ctx, input }) => getCandidates(ctx.session.user.id, input.transactionId)),

  link: protectedProcedure
    .input(z.object({ debitId: z.string(), creditId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      linkTransferPair(ctx.session.user.id, input.debitId, input.creditId)),

  unlink: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      unlinkTransferPair(ctx.session.user.id, input.transactionId)),

  getUnmatched: protectedProcedure
    .query(async ({ ctx }) => getUnmatchedTransfers(ctx.session.user.id)),

  getPairs: protectedProcedure
    .query(async ({ ctx }) => getTransferPairs(ctx.session.user.id)),
});
```

---

## Phase 2 — TransferLinkDrawer

**File:** `src/components/transactions/TransferLinkDrawer.tsx`

- Receives `sourceTransaction` as prop
- Calls `api.transfer.getCandidates.useQuery({ transactionId })`
- Renders scored candidate list with confidence bar
- Shows amount-mismatch warning if `amountDiffWarning !== null`
- Confirm → calls `api.transfer.link.useMutation()`
- On success: invalidate `transactionLedger.getAll`, close drawer

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Debit "Transfer" transactions do NOT appear in `MonthlyExpenseSummary` | Unit test |
| 2 | Uploading CSV with transfer debit creates `Transaction(DEBIT, EXCLUDED, category='Transfer')` | Unit + integration test |
| 3 | Two transactions can be linked as transfer pair | Unit test |
| 4 | Linking a previously-CONFIRMED debit reverses its `MonthlyExpenseSummary` | Unit test |
| 5 | Unlinking restores both transactions to `preLinkCategory`/`preLinkStatus` | Unit test |
| 6 | `getCandidates` returns candidates sorted by score DESC, excluding same-account | Unit test |
| 7 | A transaction cannot be in two transfer pairs (`@unique` constraint + service guard) | Prisma constraint + unit test |

---

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `transferLinkedTransactionId`, `preLinkCategory`, `preLinkStatus` |
| `src/server/services/transactions/_types.ts` | CREATE/MODIFY | `TransferCandidateScore`, `TransferLinkResult`, `TransferUnlinkResult` |
| `src/server/services/transactions/transfer.service.ts` | CREATE | `getCandidates`, `linkTransferPair`, `unlinkTransferPair`, `getUnmatchedTransfers` |
| `src/server/api/routers/transfer.ts` | CREATE | tRPC router with `getCandidates`, `link`, `unlink`, `getUnmatched`, `getPairs` |
| `src/server/api/root.ts` | MODIFY | Register `transfer` router |
| `src/server/api/routers/transaction-ledger.ts` | MODIFY | Include `transferLinkedTransactionId` in `TransactionRow`; `transferOnly` filter |
| `src/components/transactions/TransactionLedgerTable.tsx` | MODIFY | "Link as Transfer" and "Unlink" icon buttons on eligible rows |
| `src/components/transactions/TransferLinkDrawer.tsx` | CREATE | Scored candidate list, confirm/cancel, mismatch warning |
| `src/components/transactions/UnmatchedTransfersBadge.tsx` | CREATE | Count badge in Transfer tab |
