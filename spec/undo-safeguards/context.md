# Undo Safeguards — Context

## Problem Summary

The current undo (void) system has two unresolved gaps. First, when a session is undone, any
transactions that were manually linked as transfer pairs to counterparts **in other sessions** leave
those counterparts permanently stranded: EXCLUDED, category=Transfer, with a stale
`transferLinkedTransactionId` pointing at a VOIDED record. The normal unlink UI fails because
it expects both sides to be non-voided. Second, there is no time or fiscal-year boundary on undo
— a user can reverse an import from a year they have already filed tax returns for, silently
corrupting records they relied on for those returns.

---

## File Inventory

### Files to Modify

| File | Change |
|---|---|
| `src/server/services/transactions/void.service.ts` | Add `clearTransferLink()` helper; call it per-tx before status gate |
| `src/server/services/transactions/transfer.service.ts` | Extract inner unlink logic as `unlinkTransferPairInTx()` for reuse |
| `src/server/trpc/router/transaction-clearing.ts` | Enforce undo cutoff: reject if session spans locked fiscal year; return `yearWarning` flag if spanning previous year |
| `src/server/trpc/router/transaction-clearing.ts` | Add `listImportSessions` field `yearWarning: boolean` |
| `src/components/transactions/ImportSessionHistory.tsx` | Show ⚠️ badge for previous-year sessions; show "Locked" state; surface extra confirm copy |
| `prisma/schema.prisma` | Add `lockedAt DateTime?` to `CalendarYear` |
| `src/server/trpc/router/calendar-year.ts` (or equivalent) | Add `lockYear` / `unlockYear` mutations |
| `src/app/(authorized)/settings/calendar/` | Add lock toggle to calendar year settings UI |

### Files to Create

| File | Purpose |
|---|---|
| `src/server/services/transactions/void-transfer.service.ts` | Isolated transfer-pair cleanup logic used during void |

---

## Schema — Verbatim Relevant Blocks

```prisma
model Transaction {
  id                          String                @id @default(cuid())
  date                        DateTime
  description                 String
  amount                      Decimal               @db.Money
  type                        TransactionTypeEnum
  category                    String
  offsetCategory              String?
  offsetTransactionId         String?
  source                      TransactionSourceEnum
  status                      TransactionStatusEnum @default(PENDING)
  confirmedAt                 DateTime?

  bankAccount                 BankAccount?          @relation(fields: [bankAccountId], references: [id])
  bankAccountId               String?
  user                        User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                      String
  importSession               ImportSession?        @relation(fields: [importSessionId], references: [id])
  importSessionId             String?

  offsetTransaction           Transaction?  @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements              Transaction[] @relation("ReimbursementLink")
  donationPayment             DonationPayment?
  incomeRecord                IncomeRecord?

  // Transfer reconciliation
  transferLinkedTransactionId String?               @unique
  transferLinkedTransaction   Transaction?          @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
  transferCounterpart         Transaction?          @relation("TransferLink")
  preLinkCategory             String?
  preLinkStatus               TransactionStatusEnum?

  createdAt                   DateTime              @default(now())
  updatedAt                   DateTime              @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}

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
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([userId, createdAt])
}

model CalendarYear {
  id         String         @id @default(cuid())
  type       CalendarTypeEnum   // FISCAL | CALENDAR
  fromYear   Int
  fromMonth  Int
  toYear     Int
  toMonth    Int
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ... ledger relations ...
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  // Proposed addition:
  // lockedAt  DateTime?   -- non-null = user has explicitly locked this year
}

enum ImportStatusEnum {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
  VOIDED
}

enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
  VOIDED
}
```

---

## Transfer Link Data Model

The `"TransferLink"` relation is a **self-referential 1:1** on `Transaction`:

```
DEBIT tx                          CREDIT tx
─────────────────                 ──────────────────
transferLinkedTransactionId ────► id
preLinkCategory = "Groceries"     preLinkCategory = "Employment"
preLinkStatus   = CONFIRMED       preLinkStatus   = CONFIRMED
category        = "Transfer"      category        = "Transfer"
status          = EXCLUDED        status          = EXCLUDED
```

- Only the **DEBIT** side stores the FK (`transferLinkedTransactionId`).
- Both sides store `preLinkCategory` / `preLinkStatus` so unlink can restore exact prior state.
- `unlinkTransferPair()` in `transfer.service.ts` already contains correct restore logic including
  `rerollupExpenseSummary()` for previously-CONFIRMED debits.

---

## Existing Patterns to Reuse

| Pattern | Location | Notes |
|---|---|---|
| `unlinkTransferPair()` | `transfer.service.ts` | Full restore logic; extract inner part for use inside `$transaction` |
| `rerollupExpenseSummary()` | `ledger.service.ts` | Called with `oldCategory: Transfer, newCategory: preLinkCategory` to re-add expense |
| `reverseDownstream()` | `void.service.ts` | Already handles `donationPayment` FK; extend for transfer |
| `ConfirmationDialog` | `src/components/ui/ConfirmationDialog.tsx` | Accepts `variant: 'danger' \| 'warning'`; use for extra year-warning confirm |
| tRPC protected procedure | `src/server/trpc/trpc.ts` | All mutations must use `protectedProcedure` |

---

## Current vs Proposed Void Flow

```
CURRENT undoImportSession():
  for each tx in session:
    reverseDownstream(tx)         ← handles expense/income/donationPayment
    (transfer link left dangling)
  updateMany → VOIDED
  session.status → VOIDED

PROPOSED undoImportSession():
  for each tx in session:
    clearTransferLink(tx, sessionTxIds)   ← NEW: restore counterpart or clear within-batch
    reverseDownstream(tx)
  updateMany → VOIDED
  session.status → VOIDED

PROPOSED undo cutoff check (before any of the above):
  derive fiscal years spanned by session transactions
  if any spanned year has lockedAt → REJECT (TRPCError BAD_REQUEST)
  if any spanned year is a previous fiscal year (unlocked) → proceed but set yearWarning=true in response
```

---

## Known Constraints

- `unlinkTransferPair()` calls `prisma.$transaction()` internally — cannot be called nested inside
  the existing `$transaction` in `undoImportSession`. Must extract the inner Prisma client work as
  a separate function that accepts a tx-scoped db client.
- The debit side of a transfer pair is the only one that stores `transferLinkedTransactionId`.
  When voiding the **credit** side, you must `findFirst({ where: { transferLinkedTransactionId: tx.id } })`
  to locate the debit and restore it.
- Both sides may be in the same session (user imported both accounts in one CSV). In that case
  the counterpart does not need its preLinkCategory/Status restored — it will be VOIDED anyway.
  Use `sessionTxIds: Set<string>` to detect this.
- `CalendarYear` has no `lockedAt` field yet — requires a non-breaking migration (nullable column).
