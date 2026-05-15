# Transaction Deduplication — Context

## Problem

The CSV import wizard at `/cashflow/transactions` has zero deduplication. If a user uploads a Jan–Mar CSV and later uploads a Jan–Jun CSV (overlapping periods), the Jan–Mar transactions are inserted again as new rows — doubling expenses in `MonthlyExpenseSummary`, creating duplicate `IncomeRecord` entries, and inflating all roll-up views. User overrides (manual category corrections, reimbursement promotions with `offsetCategory` and `offsetTransactionId`) on the original rows are lost in the noise because the duplicate rows carry only the fresh LLM classifications.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/server/services/transactions/dedup.service.ts` | Deduplication logic: batch-query existing transactions for a month range, build lookup set, expose `isDuplicate` check |
| `src/__tests__/unit/dedup.service.test.ts` | Unit tests for dedup service |
| `src/__tests__/unit/csv-confirm-dedup.test.ts` | Integration-style unit tests for csv-confirm with dedup wired in |

### Files to MODIFY

| File | Change |
|---|---|
| `src/server/services/transactions/_types.ts` | Extend `TransactionSaveResult` with `duplicatesSkipped: number` |
| `src/server/services/transactions/csv-confirm.service.ts` | Import dedup service; batch pre-fetch existing transactions per month; skip duplicates before `createTransactionRecord`; accumulate `duplicatesSkipped` count |
| `src/app/api/transactions/csv/confirm/route.ts` | Aggregate `duplicatesSkipped` from debit + credit results; include in JSON response |
| `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts` | Add `duplicatesSkipped: number` to `CSVImportResult` |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx` | Display duplicates-skipped count in results UI (neutral styling, not error) |

---

## Schema Details

### `Transaction` model

```prisma
model Transaction {
  id                  String                @id @default(cuid())
  date                DateTime
  description         String
  amount              Decimal               @db.Money
  type                TransactionTypeEnum
  category            String
  offsetCategory      String?
  offsetTransactionId String?
  source              TransactionSourceEnum
  status              TransactionStatusEnum @default(PENDING)
  confirmedAt         DateTime?

  bankAccount         BankAccount?          @relation(fields: [bankAccountId], references: [id])
  bankAccountId       String?
  user                User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId              String
  importSession       ImportSession?        @relation(fields: [importSessionId], references: [id])
  importSessionId     String?

  offsetTransaction Transaction? @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements    Transaction[] @relation("ReimbursementLink")

  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}
```

### `MonthlyExpenseSummary` model (aggregate, not per-transaction)

```prisma
model MonthlyExpenseSummary {
  id              String          @id @default(cuid())
  month           Int
  amount          Decimal         @db.Money
  category        ExpenseCategory @relation(fields: [categoryId], references: [id])
  categoryId      String
  expenseLedger   ExpenseLedger   @relation(fields: [expenseLedgerId], references: [id], onDelete: Cascade)
  expenseLedgerId String
  importImage     ImportImage?    @relation(fields: [importImageId], references: [id])
  importImageId   String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([expenseLedgerId, month])
}
```

### `IncomeRecord` model (per-event)

```prisma
model IncomeRecord {
  id             String               @id @default(cuid())
  dateEarned     DateTime
  amount         Decimal              @db.Money
  source         IncomeSourceEnumType
  incomeLedger   IncomeLedger         @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId String
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  @@index([incomeLedgerId, dateEarned])
}
```

---

## Existing Patterns to Reuse

### `createTransactionRecord` — plain insert (no dedup today)

```typescript
async function createTransactionRecord(params: {
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  category: string;
  status: TransactionStatusEnum;
  userId: string;
  bankAccountId: string;
  importSessionId: string;
  source: TransactionSourceEnum;
}) {
  await prisma.transaction.create({
    data: {
      date: new Date(params.date),
      description: params.description,
      amount: params.amount,
      type: params.type,
      category: params.category,
      source: params.source,
      status: params.status,
      confirmedAt: new Date(),
      userId: params.userId,
      bankAccountId: params.bankAccountId,
      importSessionId: params.importSessionId,
    },
  });
}
```

### `upsertMonthlyExpenseSummary` — find-first then create-or-increment

```typescript
async function upsertMonthlyExpenseSummary(params: {
  ledgerId: string; categoryId: string; monthNum: number; amount: number;
}) {
  const existing = await prisma.monthlyExpenseSummary.findFirst({
    where: { expenseLedgerId: params.ledgerId, categoryId: params.categoryId, month: params.monthNum },
  });
  if (existing) {
    await prisma.monthlyExpenseSummary.update({
      where: { id: existing.id },
      data: { amount: { increment: params.amount } },
    });
    return;
  }
  await prisma.monthlyExpenseSummary.create({ data: { ... } });
}
```

### `MerchantCategoryMap` upsert — already idempotent

```typescript
await prisma.merchantCategoryMap.upsert({
  where: { userId_description: { userId, description: tx.description.toLowerCase().trim() } },
  update: { category: tx.confirmedCategory, source: '...' },
  create: { userId, description: tx.description.toLowerCase().trim(), category: tx.confirmedCategory, source: '...' },
});
```

### Confirm route response aggregation

```typescript
const [debitResult, creditResult] = await Promise.all([
  confirmDebitTransactions(debitMonths, session.user.id, bankAccountId, fileId),
  confirmCreditTransactions(creditMonths, session.user.id, bankAccountId, fileId),
]);
const totalEntries = debitResult.totalEntries + creditResult.totalEntries;
```

---

## Data Flow

### Current — no deduplication

```
CSVImportWizard → upload → classify (SSE, LLM) → review → confirm
  POST /api/transactions/csv/confirm
    → confirmDebitTransactions()
        for each tx:
          upsertMonthlyExpenseSummary()   ← amount added unconditionally
          createTransactionRecord()       ← row created unconditionally
          merchantCategoryMap.upsert()    ← idempotent (no issue)
    → confirmCreditTransactions()
        for each tx:
          if excluded → createTransactionRecord(EXCLUDED)   ← row created unconditionally
          if income   → incomeRecord.create() + createTransactionRecord(CONFIRMED) ← both created unconditionally
  → CSVResultsStep: debitsSaved, creditsSaved, creditsExcluded
```

**Problem**: Overlapping date ranges re-insert identical transactions → doubled `MonthlyExpenseSummary` amounts, duplicate `IncomeRecord` rows, user edits on originals orphaned.

### Proposed — with dedup

```
CSVImportWizard → upload → classify (SSE, LLM) → review → confirm
  POST /api/transactions/csv/confirm
    → confirmDebitTransactions()
        batch pre-fetch existing txns for (userId, bankAccountId, month range)
        build in-memory lookup set: key = "date|description|amount|type"
        for each tx:
          if lookup.has(key) → skip, duplicatesSkipped++
          else:
            upsertMonthlyExpenseSummary()
            createTransactionRecord()
            merchantCategoryMap.upsert()
    → confirmCreditTransactions()
        batch pre-fetch existing txns for (userId, bankAccountId, month range)
        build in-memory lookup set
        for each tx:
          if lookup.has(key) → skip, duplicatesSkipped++
          else:
            if excluded → createTransactionRecord(EXCLUDED)
            if income   → incomeRecord.create() + createTransactionRecord(CONFIRMED)
  → CSVResultsStep: debitsSaved, creditsSaved, creditsExcluded, duplicatesSkipped
```

---

## Known Constraints

### Existing index coverage

The composite index `@@index([userId, bankAccountId, date])` already covers the primary lookup columns for the dedup batch query. Adding `description`, `amount`, and `type` to the WHERE clause will filter in-memory after the index scan — acceptable for typical month-sized result sets (30–200 rows).

### Batch-fetch performance

Rather than issuing one `findFirst` per incoming CSV row (O(n) queries), we pre-fetch all existing transactions for the user + bank account + month range in a single `findMany`, then check against an in-memory `Set`. This keeps the dedup at O(1) per row after an O(n) pre-load.

### Edge case — same-day same-amount different real transactions

Two genuinely distinct transactions with identical `(date, description, amount, type)` are rare but possible (e.g., two identical $5.00 coffees at the same merchant on the same day). Phase 1 accepts this false positive — one will be skipped. Phase 2 could add count-based matching or a review UI.

### Amount precision

`Transaction.amount` is `Decimal @db.Money` (PostgreSQL `money` type). CSV amounts arrive as JavaScript `number`. The dedup key must normalise to a fixed-precision string (e.g., 2 decimal places) to avoid floating-point mismatch.

### Description normalisation

Bank statement descriptions may have trailing whitespace or case variance across exports. The dedup key should apply `.trim().toLowerCase()` to descriptions before comparison. This matches the existing `merchantCategoryMap` pattern which already uses `.toLowerCase().trim()`.