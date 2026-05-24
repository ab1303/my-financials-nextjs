# Transaction Deduplication — Low Level Design

## Phase Map

| Phase | Files | Description | Deps |
|---|---|---|---|
| **0** | `prisma/schema.prisma` | Add `runningBalance Decimal?` to Transaction | none |
| **1** | `dedup.service.ts` | Update `DedupKeyParams`, `makeDedupKey`, `buildDedupSet` | Phase 0 |
| **2** | `_types.ts`, `csv-classifier.service.ts` | Thread `balance` through classify pipeline | Phase 0 |
| **3** | `csv-confirm.service.ts` | Pass balance to dedup key + store runningBalance | Phase 1 + 2 |

---

## Phase 0 — Schema Migration

**File:** `prisma/schema.prisma`

Add `runningBalance` as an optional nullable field on `Transaction`:

```prisma
model Transaction {
  // ... existing fields ...
  runningBalance  Decimal?  @db.Money   // bank account balance after this tx; used as dedup tiebreaker
  // ... rest of model ...
}
```

Run:
```bash
pnpm prisma migrate dev --name add_transaction_running_balance
```

---

## Phase 1 — Dedup Service (Updated)

**File:** `src/server/services/transactions/dedup.service.ts`

```typescript
export interface DedupKeyParams {
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  runningBalance?: number | null;  // optional: used as tiebreaker when available
}

export function makeDedupKey(params: DedupKeyParams): string {
  const dateStr = params.date.slice(0, 10);
  const desc = params.description.trim().toLowerCase();
  const amount = params.amount.toFixed(2);
  const type = params.type;
  // Only append balance when it's a real number; null/undefined = omit (graceful fallback)
  const balance = params.runningBalance != null
    ? `|${Number(params.runningBalance).toFixed(2)}`
    : '';
  return `${dateStr}|${desc}|${amount}|${type}${balance}`;
}

export interface BuildDedupSetParams {
  userId: string;
  bankAccountId: string;
  startDate: Date;
  endDate: Date;
}

export async function buildDedupSet(params: BuildDedupSetParams): Promise<Set<string>> {
  const existing = await prisma.transaction.findMany({
    where: {
      userId: params.userId,
      bankAccountId: params.bankAccountId,
      date: { gte: params.startDate, lte: params.endDate },
      status: { not: 'VOIDED' }, // AD-13: VOIDED = not present for dedup
    },
    select: {
      date: true,
      description: true,
      amount: true,
      type: true,
      runningBalance: true,  // include balance in key when stored
    },
  });

  const set = new Set<string>();
  for (const tx of existing) {
    const key = makeDedupKey({
      date: tx.date.toISOString(),
      description: tx.description,
      amount: Number(tx.amount),
      type: tx.type,
      runningBalance: tx.runningBalance != null ? Number(tx.runningBalance) : null,
    });
    set.add(key);
  }
  return set;
}

export function isDuplicate(key: string, dedupSet: Set<string>): boolean {
  return dedupSet.has(key);
}
```

**Key behaviour:**
- When `runningBalance` is present (CommBank, NAB): key is `date|desc|amount|type|balance` → two $197.73 HOME AFFAIRS rows on same day get different keys ✅
- When `runningBalance` is absent (ANZ stub, legacy rows): key is `date|desc|amount|type` → same as before ✅
- Re-importing same CSV: same row → same balance → same key → correctly deduped ✅

---

## Phase 2 — Thread Balance Through Classify Pipeline

### 2a — Types

**File:** `src/server/services/ai-import/_types.ts`

Add `balance?: number` to the base `ClassifiedTransaction` interface — it flows automatically to `ClassifiedTransactionV2` and `ClassifiedCreditTransaction` via extension:

```typescript
export interface ClassifiedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  llmCategory: string;
  confirmedCategory: string;
  overridden: boolean;
  balance?: number;  // ← ADD: bank running balance from CSV; passed through for dedup
}

// ClassifiedTransactionV2 extends ClassifiedTransaction — inherits balance ✅
// ClassifiedCreditTransaction — add explicitly:
export interface ClassifiedCreditTransaction {
  // ... existing fields ...
  balance?: number;  // ← ADD
}
```

### 2b — Classifier

**File:** `src/server/services/ai-import/csv-classifier.service.ts`

In both `classifyTransactions` and `classifyCreditTransactions`, thread `tx.balance` into each output object:

```typescript
// classifyTransactions — debit:
return {
  id: randomUUID(),
  description: tx.description,
  amount: tx.amount,
  date: /* existing UTC parse */,
  llmCategory,
  confirmedCategory: llmCategory,
  overridden: false,
  balance: tx.balance,  // ← ADD
};

// classifyCreditTransactions:
return {
  id: randomUUID(),
  description: tx.description,
  amount: tx.amount,
  date: /* existing UTC parse */,
  llmCategory,
  confirmedCategory: llmCategory,
  overridden: false,
  type: 'CREDIT' as const,
  balance: tx.balance,  // ← ADD
};
```

---

## Phase 3 — Confirm Service

**File:** `src/server/services/transactions/csv-confirm.service.ts`

### 3a — createTransactionRecord — add `runningBalance?`

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
  runningBalance?: number;  // ← ADD
}) {
  await prisma.transaction.create({
    data: {
      // ... existing fields ...
      runningBalance: params.runningBalance ?? null,  // ← ADD
    },
  });
}
```

### 3b — confirmDebitTransactions — pass balance

```typescript
const dedupKey = makeDedupKey({
  date: tx.date,
  description: tx.description,
  amount: tx.amount,
  type: 'DEBIT',
  runningBalance: (tx as ClassifiedTransactionV2).balance ?? null,  // ← ADD
});

// ... after creating record:
dedupSet.add(makeDedupKey({
  date: tx.date,
  description: tx.description,
  amount: tx.amount,
  type: 'DEBIT',
  runningBalance: (tx as ClassifiedTransactionV2).balance ?? null,  // ← ADD (consistent with above)
}));
```

And in `createTransactionRecord` call:
```typescript
await createTransactionRecord({
  // ... existing params ...
  runningBalance: (tx as ClassifiedTransactionV2).balance,  // ← ADD
});
```

Apply same pattern for `confirmCreditTransactions` with `ClassifiedCreditTransaction`.

---

## Success Criteria

| # | Criterion | How verified |
|---|---|---|
| 1 | Uploading same CSV twice produces zero new `Transaction` rows on second import | Unit test |
| 2 | Three $197.73 HOME AFFAIRS rows on same day (different balances) → all 3 imported | Unit test (the false-dedup regression test) |
| 3 | Two $5.00 weekly transfers on same day (different balances) → both imported | Unit test |
| 4 | `MonthlyExpenseSummary` amounts unchanged after duplicate import | Unit test |
| 5 | `IncomeRecord` count unchanged after duplicate import | Unit test |
| 6 | `duplicatesSkipped` count equals truly overlapping transactions (not false positives) | Unit test |
| 7 | CSV with partial overlap correctly saves new rows and skips duplicates | Unit test |
| 8 | When bank format has no balance column (`runningBalance = undefined`), dedup still works with 5-field key | Unit test |
| 9 | Existing DB rows with `runningBalance = null` are still matched correctly on re-import | Unit test |
| 10 | VOIDED transactions are excluded from dedup set | Unit test |
| 11 | Re-importing after undo creates fresh rows (not blocked by VOIDED dedup keys) | Integration test |
| 12 | `Transaction.runningBalance` is stored for all new CSV imports | DB assertion |

---

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `runningBalance Decimal?` to Transaction model |
| `src/server/services/ai-import/_types.ts` | MODIFY | Add `balance?: number` to `ClassifiedTransaction` and `ClassifiedCreditTransaction` |
| `src/server/services/ai-import/csv-classifier.service.ts` | MODIFY | Thread `tx.balance` into both classifier output objects |
| `src/server/services/transactions/dedup.service.ts` | MODIFY | `DedupKeyParams` + `makeDedupKey` + `buildDedupSet` updated for `runningBalance` |
| `src/server/services/transactions/csv-confirm.service.ts` | MODIFY | `createTransactionRecord` + `confirmDebitTransactions` + `confirmCreditTransactions` updated |


---

## Phase 1 — Dedup Service

**File:** `src/server/services/transactions/dedup.service.ts`

```typescript
export interface DedupParams {
  userId:        string;
  bankAccountId: string;
  startDate:     Date;
  endDate:       Date;
}

export function makeDedupKey(
  date: Date,
  description: string,
  amount: Decimal,
  type: TransactionTypeEnum,
): string {
  return [
    date.toISOString().split('T')[0],
    description.trim().toLowerCase(),
    Number(amount).toFixed(2),
    type,
  ].join('|');
}

export async function buildDedupSet(params: DedupParams): Promise<Set<string>> {
  const existing = await prisma.transaction.findMany({
    where: {
      userId:        params.userId,
      bankAccountId: params.bankAccountId,
      date:          { gte: params.startDate, lte: params.endDate },
      status:        { not: 'VOIDED' }, // AD-13: VOIDED = not present for dedup
    },
    select: { date: true, description: true, amount: true, type: true },
  });

  return new Set(existing.map((tx) => makeDedupKey(tx.date, tx.description, tx.amount, tx.type)));
}

export function isDuplicate(key: string, dedupSet: Set<string>): boolean {
  return dedupSet.has(key);
}
```

**AD-13: VOIDED = not present for dedup purposes**

A VOIDED transaction's financial effect has been reversed. From the import perspective it is equivalent to "never imported" — it must not block a subsequent import of the same real-world transaction. This is consistent with `undoImportSession` semantics: the point of Undo is to let the user start fresh.

---

## Phase 2 — CSV Confirm Integration

**File:** `src/server/services/transactions/csv-confirm.service.ts`

Pattern for both `confirmDebitTransactions` and `confirmCreditTransactions`:

```typescript
// Before the transaction loop:
const dedupSet = await buildDedupSet({
  userId,
  bankAccountId,
  startDate: minDate, // derived from incoming transactions
  endDate:   maxDate,
});

let duplicatesSkipped = 0;

for (const tx of transactions) {
  const key = makeDedupKey(tx.date, tx.description, tx.amount, tx.type);
  if (isDuplicate(key, dedupSet)) {
    duplicatesSkipped++;
    continue;
  }
  // ... existing confirm logic
}

return { ...existingResult, duplicatesSkipped };
```

---

## Phase 3 — API Response + UI

**File:** `src/app/api/transactions/csv/confirm/route.ts`

```typescript
const [debitResult, creditResult] = await Promise.all([
  confirmDebitTransactions(...),
  confirmCreditTransactions(...),
]);

return NextResponse.json({
  ...existingFields,
  duplicatesSkipped: debitResult.duplicatesSkipped + creditResult.duplicatesSkipped,
});
```

**File:** `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx`

```tsx
{result.duplicatesSkipped > 0 && (
  <ResultRow
    label="Duplicates Skipped"
    value={result.duplicatesSkipped}
    className="text-muted-foreground"
  />
)}
```

---

## Success Criteria

| # | Criterion | How verified |
|---|---|---|
| 1 | Uploading same CSV twice produces zero new `Transaction` rows on second import | Unit test |
| 2 | `MonthlyExpenseSummary` amounts unchanged after duplicate import | Unit test |
| 3 | `IncomeRecord` count unchanged after duplicate import | Unit test |
| 4 | `duplicatesSkipped` count equals overlapping transactions | Unit test |
| 5 | CSVResultsStep shows "Duplicates Skipped: N" when N > 0 | Component test |
| 6 | CSVResultsStep does NOT show duplicates row when N = 0 | Component test |
| 7 | User overrides on original rows untouched after duplicate import | Unit test |
| 8 | CSV with partial overlap correctly saves new rows and skips duplicates | Unit test |
| 9 | Description matching is case-insensitive and whitespace-trimmed | Unit test |
| 10 | Amount matching uses fixed 2-decimal precision | Unit test |
| 11 | VOIDED transactions are excluded from dedup set | Unit test |
| 12 | Re-importing after undo creates fresh rows (not blocked by VOIDED dedup keys) | Integration test |

---

## Future — Phase 2 Composite Unique Constraint

```prisma
model Transaction {
  @@unique([userId, bankAccountId, date, description, amount, type], name: "unique_transaction_natural_key")
}
```

Requires one-time retroactive dedup before constraint can be applied.

---

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/transactions/dedup.service.ts` | CREATE | `buildDedupSet`, `makeDedupKey`, `isDuplicate` |
| `src/server/services/transactions/csv-confirm.service.ts` | MODIFY | Call `buildDedupSet`; skip duplicates; return `duplicatesSkipped` |
| `src/app/api/transactions/csv/confirm/route.ts` | MODIFY | Aggregate `duplicatesSkipped` in response |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx` | MODIFY | Show "Duplicates Skipped: N" when N > 0 |
