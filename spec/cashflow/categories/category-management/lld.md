# Category Management — LLD

## Overview
This cashflow-taxonomy feature migrates income-source classification from a compile-time enum to a managed lookup table and introduces a unified Settings > Categories experience for both income sources and expense categories. It also updates dependent transaction and import flows so all category consumers read from database-backed records.

---

## Implementation Slices

### 1. Schema and migration
- Add an `IncomeSource` model with `id`, `name`, `isActive`, and timestamps.
- Replace `IncomeRecord.source` enum storage with an `incomeSourceId` foreign key.
- Use a manual SQL migration to seed canonical income-source records, backfill existing rows, then drop the old enum column/type.

### 2. Category/source CRUD APIs
- Add authenticated CRUD routers for `IncomeSource` and `ExpenseCategory`.
- Return usage counts so delete flows can choose hard delete vs soft delete.
- Keep list endpoints for both management UI and active-only selection surfaces.

### 3. Income feature adoption
- Replace enum-based form validation and static label maps with `incomeSourceId` selection.
- Join `IncomeSource` when reading income records so UIs display canonical names.
- Remove remaining compile-time dependencies on `IncomeSourceEnumType`.

### 4. Import and ledger integration
- Update transaction-ledger filter options to query managed income sources.
- Resolve imported income-source strings to managed records before saving.
- Preserve a server-side fallback path (for example `Other`) when classifiers return an unknown source label.

### 5. Settings UI
- Add `/settings/categories` with client-side tabbed panels for income sources and expense categories.
- Support add, rename, delete/deactivate, inactive-state display, and confirmation messaging when records are in use.

---

## Data Contracts

### Income source record
```ts
{
  id: string;
  name: string;
  isActive: boolean;
  usageCount: number;
}
```

### Delete result
```ts
{
  softDeleted: boolean;
}
```

### Migration guarantees
- Existing income records must be backfilled to a valid `incomeSourceId`
- Seeded source names must cover all historical enum values
- The new foreign key becomes non-null only after backfill succeeds

---

## Validation Notes
- Duplicate names should fail at the API boundary with a user-friendly error.
- Delete must deactivate when linked records exist and hard-delete only when safe.
- All category/source dropdowns and cashflow filter surfaces should read from database state, not static constants.

---

## Files
| File | Action | Description |
|---|---|---|
| `prisma\schema.prisma` | MODIFY | Add `IncomeSource` model and replace enum-backed `IncomeRecord.source` with `incomeSourceId` FK |
| `prisma\migrations\...\migration.sql` | CREATE | Seed income sources, backfill historical records, and remove the enum storage path |
| `src\server\trpc\router\income-source.ts` | CREATE | Authenticated CRUD router for managed income sources |
| `src\server\trpc\router\expense-category.ts` | CREATE | Authenticated CRUD router for expense categories |
| `src\server\trpc\router\_app.ts` | MODIFY | Register new category-management routers |
| `src\app\(authorized)\settings\categories\page.tsx` | CREATE | Server entry point for Settings > Categories |
| `src\app\(authorized)\settings\categories\_components\CategoriesClient.tsx` | CREATE | Client wrapper for tabbed category management UX |
| `src\app\(authorized)\settings\categories\_components\IncomeSources.tsx` | CREATE | Income-source CRUD panel |
| `src\app\(authorized)\settings\categories\_components\ExpenseCategories.tsx` | CREATE | Expense-category CRUD panel |
| `src\app\(authorized)\cashflow\income\_schema.ts` | MODIFY | Replace enum validation with `incomeSourceId` string validation |
| `src\app\(authorized)\cashflow\income\_types.ts` | MODIFY | Remove static enum label mapping and expose joined income-source fields |
| `src\app\(authorized)\cashflow\income\actions.ts` | MODIFY | Submit `incomeSourceId` rather than enum values |
| `src\app\(authorized)\cashflow\income\_table\columns.tsx` | MODIFY | Render canonical income-source names from joined lookup data |
| `src\server\services\income.service.ts` | MODIFY | Persist and read `incomeSourceId`/`incomeSource.name` |
| `src\server\trpc\router\transaction-ledger.ts` | MODIFY | Query active managed income sources for filter options |
| `src\server\services\transactions\csv-confirm.service.ts` | MODIFY | Resolve imported source labels to managed income-source IDs |
| `src\server\services\transactions\ledger.service.ts` | MODIFY | Use managed income-source resolution in transaction-derived income flows |
| `src\app\api\transactions\csv\classify\route.ts` | MODIFY | Supply DB-backed income source names to classifiers |
| `src\app\api\transactions\ai\confirm\route.ts` | MODIFY | Resolve AI-confirmed source labels to managed IDs before persistence |
| `src\server\services\ai-import\csv-classifier.service.ts` | MODIFY | Consume DB-backed income-source labels instead of enum values |
| `src\components\Header.tsx` | MODIFY | Add or expose navigation entry for Settings > Categories if needed |

---

## Acceptance Criteria
- Users can create, rename, and deactivate/delete income sources and expense categories from Settings.
- Existing income records survive the migration with correct source linkage.
- Income entry, ledger filters, and import pipelines use managed lookup data rather than hardcoded enums.
- Historical records remain visible after category/source deactivation.
