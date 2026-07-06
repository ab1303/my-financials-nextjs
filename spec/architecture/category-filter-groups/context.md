# Category Filter Groups — Context

Users can already create and manage category groups, but the expense experience still shows a flat list of categories. The goal of this feature is to add a grouped rollup mode on the expense page and a grouped filter selector so users can answer “where is my money going?” at a macro level without losing category detail. Phase A establishes the shared data plumbing and grouping utility; Phase B makes the expense breakdown widget interactive.

## Domain dependencies

This feature depends on the feature-level HLD in `spec/architecture/category-filter-groups/hld.md`. It reuses the existing category-group CRUD service and the expense reporting pipeline, and it should not introduce a new schema or a parallel grouping model.

## Scope boundary

### In scope

- Threading `categoryGroups` through the expense page server/client pipeline
- Shared grouping utility for expense breakdowns and entries
- Grouped rollup mode for the expense category breakdown widget
- Shared category selection state across Categories/Groups views
- Grouped filter control and per-group drill-down interactions

### Out of scope

- New Prisma tables or migration work
- Backend group rollup endpoints
- Analytics chart redesigns
- Income rollup parity
- Group color editor or budget features

## Schema references

The feature relies on the existing Prisma models below.

```prisma
model ExpenseCategory {
  id                             String                         @id @default(cuid())
  name                           String                         @unique
  isActive                       Boolean                        @default(true)
  createdAt                      DateTime                       @default(now())
  iconName                       String?
  description                    String?
  monthlyExpenseSummaries        MonthlyExpenseSummary[]
  categoryGroupExpenseCategories CategoryGroupExpenseCategory[]
}

model CategoryGroup {
  id                String                         @id @default(cuid())
  userId            String
  scope             CategoryGroupScope
  name              String
  description       String?
  createdAt         DateTime                       @default(now())
  updatedAt         DateTime                       @updatedAt
  user              User                           @relation(fields: [userId], references: [id], onDelete: Cascade)
  expenseCategories CategoryGroupExpenseCategory[]
  incomeSources     CategoryGroupIncomeSource[]

  @@unique([userId, scope, name])
  @@index([userId, scope, createdAt])
}

model CategoryGroupExpenseCategory {
  id                String          @id @default(cuid())
  categoryGroupId   String
  expenseCategoryId String
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  categoryGroup     CategoryGroup   @relation(fields: [categoryGroupId], references: [id], onDelete: Cascade)
  expenseCategory   ExpenseCategory @relation(fields: [expenseCategoryId], references: [id], onDelete: Cascade)

  @@unique([categoryGroupId, expenseCategoryId])
  @@index([categoryGroupId, createdAt])
}

model CategoryGroupIncomeSource {
  id              String        @id @default(cuid())
  categoryGroupId String
  incomeSourceId  String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  categoryGroup   CategoryGroup @relation(fields: [categoryGroupId], references: [id], onDelete: Cascade)
  incomeSource    IncomeSource  @relation(fields: [incomeSourceId], references: [id], onDelete: Cascade)

  @@unique([categoryGroupId, incomeSourceId])
  @@index([categoryGroupId, createdAt])
}

enum CategoryGroupScope {
  INCOME
  EXPENSE
}
```

## Existing patterns to reuse

- `src/server/services/category-groups/category-groups.service.ts` for group listing and ownership rules
- `src/lib/category-group-utils.ts` for deterministic grouping/ungrouping behavior
- `ExpenseTableServer -> ExpenseTableClient` for prop threading and state ownership
- `react-select` grouped options pattern for the filter control
- `sonner` for any user-facing toasts if the selector needs error feedback

## Known constraints and gotchas

- The grouping layer must stay in sync with flat category totals.
- Categories can belong to no group at all, and those records must still render.
- Group membership is scope-bound; expense views should use `EXPENSE` groups only.
- The grouped selector should not lose selected categories when switching modes.
- Phase A should not require any schema migration or backend aggregation work.
