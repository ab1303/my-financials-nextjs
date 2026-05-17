# HLD — Category Management

## Problem & Solution

Income sources are currently a hardcoded Prisma enum (`IncomeSourceEnumType`) with 8 fixed values.
Adding a new income source (e.g. `PENSION`) requires a schema change, migration, and code deploy —
the same friction that would exist if expense categories were hardcoded. Expense categories already
use the correct architecture (a `ExpenseCategory` DB table) but lack a management UI, so users
cannot add or remove categories without running a seed script.

This feature (a) migrates income sources from a Prisma enum to a `IncomeSource` DB table mirroring
`ExpenseCategory`, and (b) adds a **Settings > Categories** page with CRUD panels for both
Income Sources and Expense Categories.

---

## Architecture Decisions

1. **`IncomeSource` table mirrors `ExpenseCategory` exactly** — same fields (`id`, `name`, `isActive`,
   `createdAt`), same `isActive` soft-delete semantics. No icon field in Phase 1 (expense categories
   have `iconName` but the UI doesn't expose it yet — parity is acceptable).

2. **`IncomeRecord.source` (enum column) → `incomeSourceId` (FK)** — the enum column is replaced
   with a FK to the new table. Migration backfills the FK from the enum value (case-insensitive match
   on name) before dropping the column. The `IncomeSourceEnumType` enum is removed from the schema.

3. **Single migration with manual SQL** — because backfilling a FK requires data manipulation between
   DDL steps, the migration is written as a manual SQL file rather than relying on `prisma migrate dev`
   auto-generation. The sequence: add nullable FK → seed table → backfill → set NOT NULL → drop old column.

4. **tRPC routers for CRUD** — two new tRPC routers: `incomeSourceRouter` and `expenseCategoryRouter`.
   Both follow the existing pattern from `bankRouter`. They are `protectedProcedure` only (auth required).
   No public access.

5. **Soft-delete on removal** — deleting an income source or expense category that has associated
   records sets `isActive = false` rather than hard-deleting. This preserves historical data integrity.
   If no records reference the item, a hard delete is performed. The UI shows a warning when soft-delete
   will occur.

6. **Settings > Categories page with tabs** — a single page at `/settings/categories` with two tabs:
   "Income Sources" and "Expense Categories". Each tab shows a name list with inline Add / Edit / Delete
   actions. Uses the existing `ConfirmationDialog` for delete confirmation.

7. **`getFilterOptions` updated** — the `transactionLedger.getFilterOptions` procedure currently returns
   `Object.values(IncomeSourceEnumType)`. After migration it queries `incomeSource.findMany({ where: { isActive: true } })`,
   returning `{ id, name }` records — same shape as `expenseCategories`.

8. **CSV + AI import resolution** — both import pipelines pass income source names as strings to
   classifiers and confirmation handlers. After migration, these strings are resolved to an `IncomeSource.id`
   via a lookup before DB insert. A fallback to the "Other" source is used if no match is found.

9. **`INCOME_SOURCE_LABELS` constant removed** — the static lookup map in `_types.ts` is deleted. All
   display labels come from the DB record's `name` field.

10. **No breaking change to existing income records** — all 4+ existing `IncomeRecord` rows are migrated
    with correct `incomeSourceId` values as part of the migration. Zero data loss.

---

## Data Model Changes

```diff
- enum IncomeSourceEnumType {
-   EMPLOYMENT
-   STOCKS
-   BONDS
-   RENTAL
-   BUSINESS
-   FREELANCE
-   DIVIDEND
-   OTHER
- }

+ model IncomeSource {
+   id            String         @id @default(cuid())
+   name          String         @unique
+   isActive      Boolean        @default(true)
+   createdAt     DateTime       @default(now())
+   incomeRecords IncomeRecord[]
+ }

  model IncomeRecord {
    id             String        @id @default(cuid())
    dateEarned     DateTime
    amount         Decimal       @db.Money
-   source         IncomeSourceEnumType
+   incomeSource   IncomeSource  @relation(fields: [incomeSourceId], references: [id])
+   incomeSourceId String
    incomeLedger   IncomeLedger  @relation(...)
    ...
  }
```

---

## Component / Service Changes (High-Level)

| Layer | Change |
|---|---|
| **Schema** | Add `IncomeSource` model; update `IncomeRecord`; remove enum |
| **Migration** | Manual SQL: seed + backfill + swap column |
| **tRPC routers** | Add `incomeSourceRouter`, `expenseCategoryRouter` |
| **`_app.ts`** | Register both new routers |
| **`getFilterOptions`** | Query `IncomeSource` table |
| **Income service** | `source: enum` → `incomeSourceId: string` |
| **Income schema/types** | `z.nativeEnum(...)` → `z.string()` for sourceId |
| **Income actions** | Pass `sourceId` from form |
| **Income table columns** | Display `incomeSource.name` from join |
| **CSV/AI import** | Resolve source name → id via lookup |
| **Settings > Categories** | New page with 2-tab CRUD UI |

---

## Success Criteria

1. User can add, rename, and soft-delete income sources from Settings > Categories
2. User can add, rename, and soft-delete expense categories from Settings > Categories
3. Income entry form shows income sources from DB (not hardcoded enum)
4. Transaction category dropdowns and filters use DB income sources
5. CSV import correctly resolves imported source names to `IncomeSource` records
6. All existing income records retain their correct source after migration
7. All existing tests pass; new CRUD tests cover the tRPC routers
8. `pnpm run build` passes with zero TypeScript errors

---

## Out of Scope / Future Phases

| Item | Reason |
|---|---|
| Icon picker for expense categories | `iconName` column exists but no UI yet; low priority |
| Icon support for income sources | Not needed; income sources are simpler |
| Reordering / drag-and-drop | Not requested; alphabetical sort is sufficient |
| Category merge (consolidate two categories into one) | Complex; separate feature |
| Per-user categories (multi-tenant isolation) | Current design: categories are shared globally; keep as-is |
| Import / export of category lists | Future nice-to-have |
