# Context — Category Management

## Problem Summary

Income sources are currently a hardcoded Prisma enum (`IncomeSourceEnumType`), meaning
adding/removing/renaming an income source requires a schema migration and code deploy.
Expense categories already exist as a flexible DB table (`ExpenseCategory`) but have no
management UI — they are seeded via a one-off script (`prisma/seed-expense-categories.ts`).
This feature unifies both under a single Settings > Categories page with full CRUD.

---

## File Inventory

### Files to CREATE

| File | Purpose |
|---|---|
| `src/app/(authorized)/settings/categories/page.tsx` | Settings categories page (Server Component) |
| `src/app/(authorized)/settings/categories/_components/CategoriesClient.tsx` | Client wrapper with Income / Expense tabs |
| `src/app/(authorized)/settings/categories/_components/IncomeSources.tsx` | Income sources CRUD panel |
| `src/app/(authorized)/settings/categories/_components/ExpenseCategories.tsx` | Expense categories CRUD panel |
| `src/server/trpc/router/income-source.ts` | tRPC router — income source CRUD |
| `src/server/trpc/router/expense-category.ts` | tRPC router — expense category CRUD |
| `prisma/migrations/.../migration.sql` | Add IncomeSource table, migrate IncomeRecord FK |

### Files to MODIFY

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `IncomeSource` model; change `IncomeRecord.source` → `incomeSource` FK; remove `IncomeSourceEnumType` enum |
| `src/server/trpc/router/_app.ts` | Register `incomeSourceRouter`, `expenseCategoryRouter` |
| `src/server/trpc/router/transaction-ledger.ts` | `getFilterOptions` — query `IncomeSource` table instead of enum |
| `src/app/(authorized)/cashflow/income/_schema.ts` | Replace `z.nativeEnum(IncomeSourceEnumType)` → `z.string()` for `sourceId` |
| `src/app/(authorized)/cashflow/income/_types.ts` | Replace `IncomeSourceEnumType` type → `string` (`sourceId`) |
| `src/app/(authorized)/cashflow/income/actions.ts` | Pass `sourceId` (string) to service |
| `src/server/services/income.service.ts` | All `source` enum refs → `incomeSourceId` FK |
| `src/server/services/transactions/csv-confirm.service.ts` | Resolve income source name → id before saving |
| `src/server/services/transactions/ledger.service.ts` | Income categorisation — resolve name → id |
| `src/app/api/transactions/csv/classify/route.ts` | Pass income source names from DB, not enum |
| `src/app/api/transactions/ai/confirm/route.ts` | Resolve income source name → id |
| `src/server/services/ai-import/csv-classifier.service.ts` | Use DB income source names |
| `src/app/(authorized)/cashflow/income/_table/columns.tsx` | Render source name from joined `incomeSource` |
| `src/components/Header.tsx` | Add Settings > Categories nav link (if nav items are hardcoded here) |

---

## Schema Details

### Current schema (to be changed)

```prisma
enum IncomeSourceEnumType {
  EMPLOYMENT
  STOCKS
  BONDS
  RENTAL
  BUSINESS
  FREELANCE
  DIVIDEND
  OTHER
}

model IncomeRecord {
  id             String               @id @default(cuid())
  dateEarned     DateTime
  amount         Decimal              @db.Money
  source         IncomeSourceEnumType        // <-- enum column
  incomeLedger   IncomeLedger         @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId String
  transaction    Transaction?         @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId  String?              @unique
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([incomeLedgerId, dateEarned])
}

model ExpenseCategory {
  id        String   @id @default(cuid())
  name      String   @unique
  iconName  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  monthlyExpenseSummaries MonthlyExpenseSummary[]
}
```

### Target schema

```prisma
// IncomeSource — user-managed income source lookup (replaces IncomeSourceEnumType)
model IncomeSource {
  id            String         @id @default(cuid())
  name          String         @unique
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  incomeRecords IncomeRecord[]
}

model IncomeRecord {
  id              String       @id @default(cuid())
  dateEarned      DateTime
  amount          Decimal      @db.Money
  incomeSource    IncomeSource @relation(fields: [incomeSourceId], references: [id])
  incomeSourceId  String                           // <-- FK replaces enum column
  incomeLedger    IncomeLedger @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId  String
  transaction     Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId   String?      @unique
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([incomeLedgerId, dateEarned])
}

// ExpenseCategory unchanged (already correct architecture)
model ExpenseCategory {
  id        String   @id @default(cuid())
  name      String   @unique
  iconName  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  monthlyExpenseSummaries MonthlyExpenseSummary[]
}
```

### Migration data seeding
Seed `IncomeSource` table from enum values before dropping the enum column:
```sql
INSERT INTO "IncomeSource" (id, name, "isActive", "createdAt")
VALUES
  (gen_random_uuid(), 'Employment', true, now()),
  (gen_random_uuid(), 'Stocks',     true, now()),
  (gen_random_uuid(), 'Bonds',      true, now()),
  (gen_random_uuid(), 'Rental',     true, now()),
  (gen_random_uuid(), 'Business',   true, now()),
  (gen_random_uuid(), 'Freelance',  true, now()),
  (gen_random_uuid(), 'Dividend',   true, now()),
  (gen_random_uuid(), 'Other',      true, now());

UPDATE "IncomeRecord" ir
SET "incomeSourceId" = is2.id
FROM "IncomeSource" is2
WHERE UPPER(is2.name) = ir.source::text;
```

---

## Existing Patterns to Reuse

### tRPC router pattern (from `src/server/trpc/router/bank.ts`)
```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { z } from 'zod';

export const bankRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => { ... }),
  create: protectedProcedure.input(createSchema).mutation(async ({ ctx, input }) => { ... }),
  update: protectedProcedure.input(updateSchema).mutation(async ({ ctx, input }) => { ... }),
  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => { ... }),
});
```

### Settings page pattern (from `src/app/(authorized)/settings/banks/`)
- `page.tsx` — Server Component, renders a Client wrapper
- Form uses `react-hook-form` + `zod` + tRPC mutations
- Toast via `sonner`

### Inline edit/delete table pattern (used in expense CRUD elsewhere)
- Table with Name column + Edit (pencil) + Delete (trash) action buttons
- Edit opens an inline form row or drawer
- Delete triggers confirmation dialog using `ConfirmationDialog` from `@/components/ui/ConfirmationDialog`

---

## Data Flow

### Current (income source)
```
IncomeRecord.source (enum) → hardcoded labels in _types.ts → UI dropdown
```

### Target (income source)
```
IncomeSource table → tRPC incomeSource.getAll → UI dropdown (same as expense categories)
```

### Filter options (transactions page)
```
// Current
getFilterOptions → Object.values(IncomeSourceEnumType)

// Target
getFilterOptions → prisma.incomeSource.findMany({ where: { isActive: true } })
```

---

## Known Constraints / Gotchas

1. **Migration is destructive** — `IncomeRecord.source` is a non-nullable enum column. Migration must:
   a. Add nullable `incomeSourceId` column
   b. Seed `IncomeSource` rows
   c. Backfill `incomeSourceId` from the enum value
   d. Make `incomeSourceId` non-nullable
   e. Drop `source` enum column
   f. Drop `IncomeSourceEnumType` enum
   This must be done as a **single migration** with manual SQL steps.

2. **CSV import uses source name strings** — `csv-confirm.service.ts` and `csv-classifier.service.ts` work with string names (e.g. `"EMPLOYMENT"`). After migration these must resolve to an `IncomeSource.id` via a lookup before saving.

3. **AI import also uses string names** — same lookup requirement for `ai/confirm` route.

4. **`INCOME_SOURCE_LABELS` constant** in `_types.ts` — can be removed once the UI reads from DB.

5. **`isActive` soft-delete** — deleting an income source used by existing `IncomeRecord`s should soft-delete (set `isActive = false`) not hard-delete, to preserve historical data integrity. Show a warning if records exist.

6. **Expense categories have no iconName UI** — iconName was added via migration but the settings page does not need to support icon management in Phase 1. Keep the column, skip the icon picker.
