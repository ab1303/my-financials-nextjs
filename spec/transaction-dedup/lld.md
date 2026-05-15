# Transaction Deduplication — Low Level Design

---

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| **Phase 1** | `dedup.service.ts` (create), `_types.ts` (modify), `csv-confirm.service.ts` (modify), `dedup.service.test.ts` (create), `csv-confirm-dedup.test.ts` (create) | Dedup service + csv-confirm integration + unit tests |
| **Phase 2** | `_types.ts` (modify), `confirm/route.ts` (modify), `csv/_types.ts` (modify), `CSVResultsStep.tsx` (modify) | Results UI update — pass through and display `duplicatesSkipped` |
| **Phase 3 (optional)** | `prisma/schema.prisma` (modify) | `@@unique` constraint migration + retroactive dedup tool |

---

## Phase 1 — Dedup Service + CSV-Confirm Integration

### 1.1 Dedup Service

**File to create:** `src/server/services/transactions/dedup.service.ts`

#### Interfaces

```typescript
import type { TransactionTypeEnum } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export interface DedupKeyParams {
  date: string;        // ISO date string (e.g., '2025-01-15' or '2025-01-15T00:00:00.000Z')
  description: string;
  amount: number;
  type: TransactionTypeEnum;  // 'DEBIT' | 'CREDIT'
}

export interface BuildDedupSetParams {
  userId: string;
  bankAccountId: string;
  startDate: Date;
  endDate: Date;
  prismaClient?: PrismaClient;  // optional, defaults to singleton
}
```

#### `makeDedupKey`

Constructs a normalised string key for lookup set membership.

```typescript
export function makeDedupKey(params: DedupKeyParams): string {
  const dateStr = params.date.slice(0, 10); // 'YYYY-MM-DD' — strip time component
  const desc = params.description.trim().toLowerCase();
  const amount = params.amount.toFixed(2);
  const type = params.type;
  return `${dateStr}|${desc}|${amount}|${type}`;
}
```

**Key format:** `"2025-01-15|woolworths town hall|42.50|DEBIT"`

#### `buildDedupSet`

Batch-fetches all existing transactions for the user + bank account within a date range, returns a `Set<string>` of normalised keys.

```typescript
export async function buildDedupSet(params: BuildDedupSetParams): Promise<Set<string>> {
  const db = params.prismaClient ?? prisma;

  const existing = await db.transaction.findMany({
    where: {
      userId: params.userId,
      bankAccountId: params.bankAccountId,
      date: {
        gte: params.startDate,
        lte: params.endDate,
      },
    },
    select: {
      date: true,
      description: true,
      amount: true,
      type: true,
    },
  });

  const set = new Set<string>();
  for (const tx of existing) {
    const key = makeDedupKey({
      date: tx.date.toISOString(),
      description: tx.description,
      amount: Number(tx.amount),   // Decimal → number for toFixed(2)
      type: tx.type,
    });
    set.add(key);
  }

  return set;
}
```

**Prisma query uses:** `@@index([userId, bankAccountId, date])` — existing index, no migration needed.

#### `isDuplicate`

```typescript
export function isDuplicate(key: string, dedupSet: Set<string>): boolean {
  return dedupSet.has(key);
}
```

#### Date range extraction helper

Extracts the min/max date from a list of month keys (`"YYYY-MM"`) to determine the pre-fetch date range.

```typescript
export function getDateRangeFromMonthKeys(monthKeys: string[]): { startDate: Date; endDate: Date } {
  const sorted = [...monthKeys].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const [firstYear, firstMonth] = first.split('-').map(Number) as [number, number];
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];

  const startDate = new Date(firstYear, firstMonth - 1, 1);            // first day of first month
  const endDate = new Date(lastYear, lastMonth, 0, 23, 59, 59, 999);  // last day of last month

  return { startDate, endDate };
}
```

---

### 1.2 Type Changes

**File to modify:** `src/server/services/transactions/_types.ts`

```typescript
export interface TransactionSaveResult {
  savedMonths: number;
  totalEntries: number;
  duplicatesSkipped: number;  // ← NEW
  errors: MonthError[];
}
```

Update `createEmptyResult()` in `csv-confirm.service.ts`:

```typescript
function createEmptyResult(): TransactionSaveResult {
  return {
    savedMonths: 0,
    totalEntries: 0,
    duplicatesSkipped: 0,  // ← NEW
    errors: [],
  };
}
```

---

### 1.3 CSV-Confirm Integration

**File to modify:** `src/server/services/transactions/csv-confirm.service.ts`

#### Import additions

```typescript
import { buildDedupSet, makeDedupKey, isDuplicate, getDateRangeFromMonthKeys } from './dedup.service';
```

#### `confirmDebitTransactions` — modified loop

```typescript
export async function confirmDebitTransactions(
  debitMonths: DebitMonth[],
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult> {
  const result = createEmptyResult();

  // === DEDUP: batch pre-fetch ===
  const monthKeys = debitMonths.map((m) => m.month);
  const { startDate, endDate } = getDateRangeFromMonthKeys(monthKeys);
  const dedupSet = await buildDedupSet({ userId, bankAccountId, startDate, endDate });
  // ==============================

  const categories = await prisma.expenseCategory.findMany({ where: { isActive: true } });
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  for (const { month: monthKey, transactions } of debitMonths) {
    try {
      const { year, monthNum } = parseMonthKey(monthKey);
      const calendarYear = await getFiscalCalendarYear(year, monthNum);

      if (!calendarYear) {
        result.errors.push({ month: monthKey, message: `No fiscal year found for ${monthKey}` });
        continue;
      }

      const ledger = await getOrCreateExpenseLedger(calendarYear.id, userId);

      for (const tx of transactions as ClassifiedTransactionV2[]) {
        // === DEDUP: check before insert ===
        const dedupKey = makeDedupKey({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: 'DEBIT',
        });
        if (isDuplicate(dedupKey, dedupSet)) {
          result.duplicatesSkipped += 1;
          continue;
        }
        // ==================================

        const categoryId = categoryMap.get(tx.confirmedCategory.toLowerCase());
        if (!categoryId) continue;

        await upsertMonthlyExpenseSummary({ ledgerId: ledger.id, categoryId, monthNum, amount: tx.amount });
        await createTransactionRecord({ /* ... unchanged ... */ });
        await prisma.merchantCategoryMap.upsert({ /* ... unchanged ... */ });

        result.totalEntries += 1;

        // === DEDUP: add to set so intra-batch duplicates are caught ===
        dedupSet.add(dedupKey);
        // ==============================================================
      }

      result.savedMonths += 1;
    } catch (error: unknown) {
      result.errors.push({ month: monthKey, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return result;
}
```

#### `confirmCreditTransactions` — same pattern

```typescript
export async function confirmCreditTransactions(
  creditMonths: CreditMonth[],
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult> {
  const result = createEmptyResult();

  // === DEDUP: batch pre-fetch ===
  const monthKeys = creditMonths.map((m) => m.month);
  const { startDate, endDate } = getDateRangeFromMonthKeys(monthKeys);
  const dedupSet = await buildDedupSet({ userId, bankAccountId, startDate, endDate });
  // ==============================

  for (const { month: monthKey, transactions } of creditMonths) {
    try {
      const { year, monthNum } = parseMonthKey(monthKey);
      const calendarYear = await getFiscalCalendarYear(year, monthNum);

      if (!calendarYear) {
        result.errors.push({ month: monthKey, message: `No fiscal year found for ${monthKey}` });
        continue;
      }

      for (const tx of transactions as ClassifiedCreditTransaction[]) {
        // === DEDUP: check before insert ===
        const dedupKey = makeDedupKey({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: 'CREDIT',
        });
        if (isDuplicate(dedupKey, dedupSet)) {
          result.duplicatesSkipped += 1;
          continue;
        }
        // ==================================

        const isExcluded = (EXCLUDED_CREDIT_LABELS as readonly string[]).includes(tx.confirmedCategory);

        if (isExcluded) {
          await createTransactionRecord({ /* ... EXCLUDED, unchanged ... */ });
        } else {
          const incomeLedger = await getOrCreateIncomeLedger(calendarYear.id, userId);
          await prisma.incomeRecord.create({ /* ... unchanged ... */ });
          await createTransactionRecord({ /* ... CONFIRMED, unchanged ... */ });
        }

        result.totalEntries += 1;
        dedupSet.add(dedupKey);
      }

      result.savedMonths += 1;
    } catch (error: unknown) {
      result.errors.push({ month: monthKey, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return result;
}
```

**Key detail — intra-batch dedup:** After inserting a new transaction, its key is added to `dedupSet`. This catches the edge case where the incoming CSV itself contains duplicate rows (same line repeated).

---

### 1.4 Unit Tests — Dedup Service

**File to create:** `src/__tests__/unit/dedup.service.test.ts`

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | `makeDedupKey` normalises date to YYYY-MM-DD, strips time | Unit | Key format correctness |
| 2 | `makeDedupKey` trims and lowercases description | Unit | Description normalisation |
| 3 | `makeDedupKey` formats amount to 2 decimal places | Unit | `12.1` → `"12.10"`, `5` → `"5.00"` |
| 4 | `makeDedupKey` includes type in the key | Unit | DEBIT and CREDIT with same date/desc/amount produce different keys |
| 5 | `buildDedupSet` returns Set with keys from existing transactions | Unit (mocked Prisma) | Batch query produces correct set |
| 6 | `buildDedupSet` returns empty Set when no existing transactions | Unit (mocked Prisma) | No false positives on empty DB |
| 7 | `isDuplicate` returns true for existing key | Unit | Set membership check |
| 8 | `isDuplicate` returns false for new key | Unit | Non-member check |
| 9 | `getDateRangeFromMonthKeys` computes correct start/end dates | Unit | `["2025-01", "2025-03"]` → Jan 1 to Mar 31 |
| 10 | `getDateRangeFromMonthKeys` handles single month | Unit | `["2025-06"]` → Jun 1 to Jun 30 |

```typescript
import { describe, it, expect } from 'vitest';
import { makeDedupKey, isDuplicate, getDateRangeFromMonthKeys } from '@/server/services/transactions/dedup.service';

describe('makeDedupKey', () => {
  it('normalises ISO datetime to date-only', () => {
    const key = makeDedupKey({
      date: '2025-01-15T10:30:00.000Z',
      description: 'Woolworths',
      amount: 42.5,
      type: 'DEBIT',
    });
    expect(key).toBe('2025-01-15|woolworths|42.50|DEBIT');
  });

  it('trims and lowercases description', () => {
    const key = makeDedupKey({
      date: '2025-01-15',
      description: '  Woolworths Town Hall  ',
      amount: 42.5,
      type: 'DEBIT',
    });
    expect(key).toBe('2025-01-15|woolworths town hall|42.50|DEBIT');
  });

  it('formats amount to 2 decimal places', () => {
    const key1 = makeDedupKey({ date: '2025-01-15', description: 'Test', amount: 12.1, type: 'DEBIT' });
    const key2 = makeDedupKey({ date: '2025-01-15', description: 'Test', amount: 12.10, type: 'DEBIT' });
    expect(key1).toBe(key2);
  });

  it('produces different keys for DEBIT vs CREDIT', () => {
    const base = { date: '2025-01-15', description: 'Test', amount: 50 };
    const debitKey = makeDedupKey({ ...base, type: 'DEBIT' });
    const creditKey = makeDedupKey({ ...base, type: 'CREDIT' });
    expect(debitKey).not.toBe(creditKey);
  });
});

describe('isDuplicate', () => {
  it('returns true when key exists in set', () => {
    const set = new Set(['2025-01-15|test|50.00|DEBIT']);
    expect(isDuplicate('2025-01-15|test|50.00|DEBIT', set)).toBe(true);
  });

  it('returns false when key does not exist', () => {
    const set = new Set(['2025-01-15|test|50.00|DEBIT']);
    expect(isDuplicate('2025-01-16|test|50.00|DEBIT', set)).toBe(false);
  });
});

describe('getDateRangeFromMonthKeys', () => {
  it('computes range for multiple months', () => {
    const { startDate, endDate } = getDateRangeFromMonthKeys(['2025-01', '2025-03']);
    expect(startDate).toEqual(new Date(2025, 0, 1));
    expect(endDate.getFullYear()).toBe(2025);
    expect(endDate.getMonth()).toBe(2); // March
    expect(endDate.getDate()).toBe(31);
  });

  it('handles single month', () => {
    const { startDate, endDate } = getDateRangeFromMonthKeys(['2025-06']);
    expect(startDate).toEqual(new Date(2025, 5, 1));
    expect(endDate.getDate()).toBe(30); // June has 30 days
  });
});
```

---

### 1.5 Unit Tests — CSV-Confirm with Dedup

**File to create:** `src/__tests__/unit/csv-confirm-dedup.test.ts`

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | `confirmDebitTransactions` skips all rows when all are duplicates | Integration (mocked Prisma) | `totalEntries = 0`, `duplicatesSkipped = N`, no `transaction.create` calls |
| 2 | `confirmDebitTransactions` saves new rows and skips duplicates in mixed batch | Integration (mocked Prisma) | Correct split between `totalEntries` and `duplicatesSkipped` |
| 3 | `confirmDebitTransactions` does not call `upsertMonthlyExpenseSummary` for skipped rows | Integration (mocked Prisma) | No expense inflation |
| 4 | `confirmCreditTransactions` skips duplicate excluded credits | Integration (mocked Prisma) | No duplicate `Transaction(EXCLUDED)` rows |
| 5 | `confirmCreditTransactions` skips duplicate income credits | Integration (mocked Prisma) | No duplicate `IncomeRecord` or `Transaction(CONFIRMED)` rows |
| 6 | `confirmCreditTransactions` saves new credits and skips duplicates in mixed batch | Integration (mocked Prisma) | Correct split |
| 7 | Intra-batch duplicates are caught (same CSV row repeated twice) | Integration (mocked Prisma) | Second occurrence is skipped |
| 8 | Description with different casing is treated as duplicate | Integration (mocked Prisma) | `"WOOLWORTHS"` matches `"woolworths"` |

---

## Phase 2 — Results UI Update

### 2.1 Confirm Route Changes

**File to modify:** `src/app/api/transactions/csv/confirm/route.ts`

Add `duplicatesSkipped` to the response:

```typescript
const [debitResult, creditResult] = await Promise.all([
  confirmDebitTransactions(debitMonths, session.user.id, bankAccountId, fileId),
  confirmCreditTransactions(creditMonths, session.user.id, bankAccountId, fileId),
]);

const totalEntries = debitResult.totalEntries + creditResult.totalEntries;
const duplicatesSkipped = debitResult.duplicatesSkipped + creditResult.duplicatesSkipped;  // ← NEW

// ... existing creditsExcluded calculation ...

return NextResponse.json({
  success: status !== 'FAILED',
  status,
  debitsSaved: debitResult.totalEntries,
  creditsSaved: creditResult.totalEntries,
  creditsExcluded,
  duplicatesSkipped,   // ← NEW
  totalEntries,
  errors,
});
```

### 2.2 Client Type Changes

**File to modify:** `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts`

```typescript
export interface CSVImportResult {
  sessionId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  debitsSaved: number;
  creditsSaved: number;
  creditsExcluded: number;
  duplicatesSkipped: number;  // ← NEW
  totalEntries: number;
  errors: Array<{ month: string; message: string }>;
}
```

### 2.3 Results Step UI

**File to modify:** `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx`

Add a conditional row after the creditsExcluded block, before the Total Entries divider:

```tsx
{result.duplicatesSkipped > 0 && (
  <div className='flex items-center justify-between'>
    <span className='text-sm font-medium text-foreground'>Duplicates Skipped</span>
    <span className='text-lg font-bold text-muted-foreground'>{result.duplicatesSkipped}</span>
  </div>
)}
```

**Styling rationale:** Uses `text-muted-foreground` (same as creditsExcluded) — informational, not an error. The value is grey/muted to signal "these were handled for you" without alarm.

### 2.4 Phase 2 Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | Confirm route returns `duplicatesSkipped` in response JSON | Integration | Route aggregation |
| 2 | CSVResultsStep renders "Duplicates Skipped" row when count > 0 | Component (RTL) | Conditional rendering |
| 3 | CSVResultsStep does not render "Duplicates Skipped" row when count = 0 | Component (RTL) | No noise on clean imports |
| 4 | CSVImportResult type includes `duplicatesSkipped` field | Type check | TypeScript compilation |

---

## Phase 3 (Optional) — Unique Constraint Migration + Retroactive Dedup

### 3.1 Retroactive Dedup Script

Before adding the `@@unique` constraint, existing duplicates must be cleaned. Create a one-time script:

```
scripts/retroactive-dedup.ts
```

Strategy:
1. Query all transactions grouped by `(userId, bankAccountId, date, description, amount, type)`
2. For each group with count > 1, keep the row with the earliest `createdAt` (preserves user overrides from first import)
3. Delete the rest
4. For deleted DEBIT rows: recalculate `MonthlyExpenseSummary` for the affected months
5. For deleted CREDIT+CONFIRMED rows: delete orphaned `IncomeRecord` entries

### 3.2 Schema Migration

**File to modify:** `prisma/schema.prisma`

```prisma
model Transaction {
  // ... all existing fields ...
  @@unique([userId, bankAccountId, date, description, amount, type], name: "unique_transaction_natural_key")
}
```

```
migration name : add_transaction_natural_key_unique
command        : pnpm prisma migrate dev --name add_transaction_natural_key_unique
```

**Pre-requisite:** Run `scripts/retroactive-dedup.ts` before applying migration, otherwise the migration will fail if duplicates exist.

### 3.3 Phase 3 Test Cases

| # | Test description | Test type | What it verifies |
|---|---|---|---|
| 1 | Retroactive dedup script keeps earliest row per group | Script test | `createdAt` ordering preserved |
| 2 | Retroactive dedup script deletes correct count of duplicates | Script test | Row count matches expected |
| 3 | `MonthlyExpenseSummary` amounts are correct after retroactive dedup | Script test | Expense totals recalculated |
| 4 | Migration applies cleanly on a deduped database | Migration test | `prisma migrate deploy` succeeds |
| 5 | Inserting a duplicate after migration throws unique constraint error | Integration | DB-level enforcement |

---

## Edge Cases

### Same-day same-amount different real transactions

Two genuinely distinct transactions: `"Starbucks CBD" $5.00 DEBIT 2025-01-15` uploaded twice, but user actually bought two coffees.

**Phase 1 behaviour:** Second occurrence is skipped (false positive).
**Phase 2 mitigation:** Count-based matching — if the incoming CSV has N rows with the same key, allow up to N minus (count of existing rows with that key) to be inserted.

### Description normalisation

| Raw description | Normalised |
|---|---|
| `"  Woolworths Town Hall  "` | `"woolworths town hall"` |
| `"WOOLWORTHS TOWN HALL"` | `"woolworths town hall"` |
| `"Woolworths town hall"` | `"woolworths town hall"` |

All three produce the same dedup key. This matches the `merchantCategoryMap` pattern.

### Amount precision

| CSV value | `toFixed(2)` | Match? |
|---|---|---|
| `12.1` | `"12.10"` | ✓ matches DB `12.10` |
| `12.105` | `"12.10"` | ✓ rounds to match (rare — bank amounts are 2dp) |
| `12` | `"12.00"` | ✓ matches DB `12.00` |

### Timezone considerations

`Transaction.date` is stored as `DateTime` (UTC midnight). CSV dates are parsed as ISO strings. The dedup key uses only the `YYYY-MM-DD` portion (`date.slice(0, 10)`), avoiding timezone mismatch between `new Date('2025-01-15')` (local) and `new Date('2025-01-15T00:00:00.000Z')` (UTC).

### Empty month arrays

If `debitMonths` or `creditMonths` is an empty array, `getDateRangeFromMonthKeys` receives no month keys. Guard with early return:

```typescript
if (monthKeys.length === 0) return result;
```