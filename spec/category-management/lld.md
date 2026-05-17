# LLD — Category Management

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| **Phase 1** | `prisma/schema.prisma`, new migration SQL | Add `IncomeSource` model, backfill `IncomeRecord.incomeSourceId`, drop enum |
| **Phase 2** | `income-source.ts` router, `expense-category.ts` router, `_app.ts` | New tRPC CRUD routers for both entity types |
| **Phase 3** | `income.service.ts`, `income/_schema.ts`, `income/_types.ts`, `income/actions.ts`, `income/_table/columns.tsx` | Update income feature to use `incomeSourceId` FK |
| **Phase 4** | `transaction-ledger.ts`, `csv-confirm.service.ts`, `ledger.service.ts`, `csv/classify/route.ts`, `ai/confirm/route.ts`, `csv-classifier.service.ts` | Update transactions/import pipelines |
| **Phase 5** | `settings/categories/page.tsx`, `CategoriesClient.tsx`, `IncomeSources.tsx`, `ExpenseCategories.tsx` | Settings UI — Categories page |

---

## Phase 1 — Schema Migration

### New model

```prisma
model IncomeSource {
  id            String         @id @default(cuid())
  name          String         @unique
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  incomeRecords IncomeRecord[]
}
```

### Updated model

```prisma
model IncomeRecord {
  id              String       @id @default(cuid())
  dateEarned      DateTime
  amount          Decimal      @db.Money
  incomeSource    IncomeSource @relation(fields: [incomeSourceId], references: [id])
  incomeSourceId  String
  incomeLedger    IncomeLedger @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId  String
  transaction     Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId   String?      @unique
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([incomeLedgerId, dateEarned])
}
```

### Migration SQL (manual, single file)

```sql
-- Step 1: Create IncomeSource table
CREATE TABLE "IncomeSource" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IncomeSource_name_key" ON "IncomeSource"("name");

-- Step 2: Seed default income sources (names match existing enum display labels)
INSERT INTO "IncomeSource" ("id", "name", "isActive", "createdAt") VALUES
  (gen_random_uuid()::text, 'Employment', true, now()),
  (gen_random_uuid()::text, 'Stocks',     true, now()),
  (gen_random_uuid()::text, 'Bonds',      true, now()),
  (gen_random_uuid()::text, 'Rental',     true, now()),
  (gen_random_uuid()::text, 'Business',   true, now()),
  (gen_random_uuid()::text, 'Freelance',  true, now()),
  (gen_random_uuid()::text, 'Dividend',   true, now()),
  (gen_random_uuid()::text, 'Other',      true, now());

-- Step 3: Add nullable FK column to IncomeRecord
ALTER TABLE "IncomeRecord" ADD COLUMN "incomeSourceId" TEXT;

-- Step 4: Backfill incomeSourceId from the enum source column
UPDATE "IncomeRecord" ir
SET "incomeSourceId" = is2."id"
FROM "IncomeSource" is2
WHERE UPPER(is2."name") = ir."source"::text;

-- Step 5: Make incomeSourceId NOT NULL
ALTER TABLE "IncomeRecord" ALTER COLUMN "incomeSourceId" SET NOT NULL;

-- Step 6: Add FK constraint
ALTER TABLE "IncomeRecord"
  ADD CONSTRAINT "IncomeRecord_incomeSourceId_fkey"
  FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Drop old enum column
ALTER TABLE "IncomeRecord" DROP COLUMN "source";

-- Step 8: Drop enum type
DROP TYPE "IncomeSourceEnumType";
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| All existing IncomeRecord rows have non-null incomeSourceId after migration | Integration (DB) | Backfill correctness |
| IncomeSource table has exactly 8 seeded rows | Integration (DB) | Seed completeness |
| IncomeRecord row with source=EMPLOYMENT maps to IncomeSource.name='Employment' | Integration (DB) | Name matching |

---

## Phase 2 — tRPC Routers

### `src/server/trpc/router/income-source.ts`

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { z } from 'zod';

const createSchema = z.object({ name: z.string().min(1).max(100) });
const updateSchema = z.object({ id: z.string(), name: z.string().min(1).max(100) });
const removeSchema = z.object({ id: z.string() });

export type IncomeSourceRecord = { id: string; name: string; isActive: boolean; usageCount: number };

export const incomeSourceRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }): Promise<IncomeSourceRecord[]> => {
    // Returns all income sources (including inactive) for management UI
    // Includes usageCount from IncomeRecord join for safe-delete UX
  }),

  getAllActive: protectedProcedure.query(async ({ ctx }) => {
    // Returns only isActive=true sources — used by income entry form
  }),

  create: protectedProcedure.input(createSchema).mutation(async ({ ctx, input }) => {
    // Creates new IncomeSource; throws on duplicate name
  }),

  update: protectedProcedure.input(updateSchema).mutation(async ({ ctx, input }) => {
    // Renames income source; throws on duplicate name
  }),

  remove: protectedProcedure.input(removeSchema).mutation(async ({ ctx, input }) => {
    // If usageCount > 0: soft-delete (isActive = false)
    // If usageCount === 0: hard delete
    // Returns { softDeleted: boolean }
  }),
});
```

### `src/server/trpc/router/expense-category.ts`

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { z } from 'zod';

const createSchema = z.object({ name: z.string().min(1).max(100) });
const updateSchema = z.object({ id: z.string(), name: z.string().min(1).max(100) });
const removeSchema = z.object({ id: z.string() });

export type ExpenseCategoryRecord = { id: string; name: string; isActive: boolean; usageCount: number };

export const expenseCategoryRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }): Promise<ExpenseCategoryRecord[]> => {
    // Returns all categories with usageCount from MonthlyExpenseSummary join
  }),

  getAllActive: protectedProcedure.query(async ({ ctx }) => {
    // Returns only isActive=true — used by expense entry form
  }),

  create: protectedProcedure.input(createSchema).mutation(async ({ ctx, input }) => { ... }),
  update: protectedProcedure.input(updateSchema).mutation(async ({ ctx, input }) => { ... }),

  remove: protectedProcedure.input(removeSchema).mutation(async ({ ctx, input }) => {
    // Soft-delete if usageCount > 0, hard-delete otherwise
    // Returns { softDeleted: boolean }
  }),
});
```

### `_app.ts` additions

```typescript
import { incomeSourceRouter } from './income-source';
import { expenseCategoryRouter } from './expense-category';

export const appRouter = router({
  // ...existing...
  incomeSource: incomeSourceRouter,
  expenseCategory: expenseCategoryRouter,
});
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| `incomeSource.getAll` returns all sources with usageCount | Unit (tRPC) | Query correctness |
| `incomeSource.create` rejects duplicate name | Unit (tRPC) | Unique constraint handling |
| `incomeSource.remove` soft-deletes when usageCount > 0 | Unit (tRPC) | Safe delete logic |
| `incomeSource.remove` hard-deletes when usageCount === 0 | Unit (tRPC) | Hard delete path |
| `expenseCategory.create` creates new category | Unit (tRPC) | Basic CRUD |
| `expenseCategory.remove` soft-deletes in-use category | Unit (tRPC) | Safe delete parity |

---

## Phase 3 — Income Feature Updates

### `src/app/(authorized)/cashflow/income/_schema.ts`

```typescript
// Replace:
source: z.nativeEnum(IncomeSourceEnumType, { required_error: 'Income source is required' })

// With:
incomeSourceId: z.string().min(1, 'Income source is required'),
```

Remove import of `IncomeSourceEnumType` from `@prisma/client`.

### `src/app/(authorized)/cashflow/income/_types.ts`

```typescript
// Remove:
export const INCOME_SOURCE_LABELS: Record<IncomeSourceEnumType, string> = { ... }

// Update IncomeEntryType:
export type IncomeEntryType = {
  id: string;
  dateEarned: Date;
  amount: number;
  incomeSourceId: string;
  incomeSourceName: string;   // from joined IncomeSource.name
  incomeLedgerId: string;
};
```

### `src/server/services/income.service.ts`

Key changes:
- `addIncomeEntry`: accept `incomeSourceId: string` instead of `source: IncomeSourceEnumType`
- `updateIncomeEntry`: same
- All Prisma queries that `select { source }` → `select { incomeSource: { select: { id, name } } }`
- Return `incomeSourceId` and `incomeSourceName` in `IncomeEntryType`

### `src/app/(authorized)/cashflow/income/_table/columns.tsx`

```typescript
// Replace:
label: INCOME_SOURCE_LABELS[value as IncomeSourceEnumType]

// With:
label: value  // incomeSourceName passed directly from IncomeEntryType
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| `addIncomeEntry` saves with valid `incomeSourceId` | Unit (service) | FK save path |
| `addIncomeEntry` rejects missing `incomeSourceId` | Unit (service) | Validation |
| `getIncomeEntries` returns `incomeSourceName` in each entry | Unit (service) | Join correctness |

---

## Phase 4 — Transaction / Import Pipeline

### `src/server/trpc/router/transaction-ledger.ts` — `getFilterOptions`

```typescript
getFilterOptions: protectedProcedure.query(async ({ ctx }) => {
  const expenseCategories = await ctx.prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  const incomeSources = await ctx.prisma.incomeSource.findMany({   // <-- changed
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return {
    expenseCategories,
    incomeSourceLabels: incomeSources.map((s) => s.name),  // keep same shape for now
  };
}),
```

### `src/server/services/transactions/csv-confirm.service.ts`

Add income source resolution helper:

```typescript
async function resolveIncomeSourceId(
  name: string,
  allSources: Array<{ id: string; name: string }>,
): Promise<string> {
  const match = allSources.find(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );
  if (!match) {
    // Fallback: find 'Other'
    return allSources.find((s) => s.name === 'Other')!.id;
  }
  return match.id;
}
```

Replace `source: tx.confirmedCategory as IncomeSourceEnumType` with resolved `incomeSourceId`.

### `src/server/services/transactions/ledger.service.ts`

Same pattern — resolve income source name → id before `prisma.incomeRecord.create/update`.

### `src/app/api/transactions/csv/classify/route.ts`

```typescript
// Replace:
incomeSourceLabels: [...Object.values(IncomeSourceEnumType), 'Transfer', 'Excluded']

// With:
const incomeSources = await prisma.incomeSource.findMany({ where: { isActive: true } });
incomeSourceLabels: [...incomeSources.map(s => s.name), 'Transfer', 'Excluded']
```

### `src/server/services/ai-import/csv-classifier.service.ts`

```typescript
// Replace:
...Object.values(IncomeSourceEnumType)

// With: pass in income source names from DB (caller fetches and passes them in)
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| `getFilterOptions` returns income sources from DB (not enum) | Unit (tRPC) | Source of truth |
| CSV confirm resolves 'EMPLOYMENT' name → correct incomeSourceId | Unit (service) | Name resolution |
| CSV confirm falls back to 'Other' for unrecognised source name | Unit (service) | Fallback |
| AI confirm resolves income source correctly | Unit (route) | AI import path |

---

## Phase 5 — Settings UI

### Route: `/settings/categories`

#### `page.tsx` (Server Component)

```typescript
export default function CategoriesPage() {
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Categories</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Manage income sources and expense categories
      </p>
      <CategoriesClient />
    </main>
  );
}
```

#### `CategoriesClient.tsx` (Client Component)

```typescript
'use client';

type Tab = 'income' | 'expense';

export default function CategoriesClient() {
  const [tab, setTab] = useState<Tab>('income');

  return (
    <div className="mt-6">
      {/* Tab buttons */}
      <div className="flex gap-4 border-b ...">
        <TabButton active={tab === 'income'} onClick={() => setTab('income')}>Income Sources</TabButton>
        <TabButton active={tab === 'expense'} onClick={() => setTab('expense')}>Expense Categories</TabButton>
      </div>

      {tab === 'income' ? <IncomeSources /> : <ExpenseCategories />}
    </div>
  );
}
```

#### `IncomeSources.tsx` (Client Component)

```typescript
interface RowState { editing: boolean; name: string }

export default function IncomeSources() {
  const utils = trpc.useUtils();
  const { data: sources = [] } = trpc.incomeSource.getAll.useQuery();

  // Inline add form state
  const [addName, setAddName] = useState('');

  const createMutation = trpc.incomeSource.create.useMutation({ onSuccess: () => { void utils.incomeSource.getAll.invalidate(); toast.success('Income source added'); } });
  const updateMutation = trpc.incomeSource.update.useMutation({ ... });
  const removeMutation = trpc.incomeSource.remove.useMutation({
    onSuccess: (result) => {
      void utils.incomeSource.getAll.invalidate();
      toast.success(result.softDeleted ? 'Income source deactivated (in use by records)' : 'Income source deleted');
    }
  });

  // Render: add input row + list of sources with edit/delete buttons
  // Inactive sources shown with muted style and "inactive" badge
  // Delete uses ConfirmationDialog
}
```

#### `ExpenseCategories.tsx` — same structure as `IncomeSources.tsx` but uses `expenseCategory.*` tRPC calls.

### UI Behaviour Rules

| Behaviour | Rule |
|---|---|
| Add | Inline text input + "Add" button at the top of the list |
| Edit | Click pencil → row becomes inline text input with Save/Cancel |
| Delete | Click trash → `ConfirmationDialog` confirms → mutation |
| Soft-delete warning | If `usageCount > 0`, confirmation dialog says "This source is used by X records. It will be deactivated (hidden from new entries) but historical records will be preserved." |
| Inactive display | Show inactive items at bottom of list, greyed out, with "Inactive" badge and a "Restore" action |
| Empty state | "No income sources yet. Add one above." |

### TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| Settings > Categories page renders without crashing | Integration (component) | Page load |
| Income Sources tab shows seeded 8 sources | Integration (component) | Data display |
| Add income source submits and updates list | Integration (component) | Create flow |
| Delete with usageCount > 0 shows soft-delete warning | Integration (component) | Warning UX |
| Expense Categories tab shows all active categories | Integration (component) | Tab switch |

---

## Integration Points & Edge Cases

| Scenario | Handling |
|---|---|
| Import CSV with source name `"EMPLOYMENT"` (uppercase enum value) | Case-insensitive match against `IncomeSource.name` |
| Import CSV with source name `"Employment"` (new title-case name) | Direct match |
| Import CSV with unrecognised source name | Fallback to 'Other' source |
| Delete income source used by IncomeRecord | Soft-delete; `isActive=false`; hidden from dropdowns |
| Delete income source with no records | Hard delete |
| Rename income source | All `IncomeRecord` rows automatically reflect new name (via FK join) |
| Add income source with duplicate name | tRPC error → toast "An income source with this name already exists" |
