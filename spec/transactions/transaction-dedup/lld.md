# Transaction Deduplication — Low Level Design

## Phase Map

| Phase | Files | Description |
|---|---|---|
| **1** | `dedup.service.ts` | `buildDedupSet`, `makeDedupKey`, `isDuplicate` |
| **2** | `csv-confirm.service.ts` | Call dedup in both confirm functions; return `duplicatesSkipped` |
| **3** | `confirm/route.ts`, `CSVResultsStep.tsx` | Surface count in API response and UI |

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
