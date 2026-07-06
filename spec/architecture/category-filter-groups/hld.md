# Category Filter Groups — HLD

Category Groups already exist in the database and in the category-groups CRUD service. The missing piece is a shared rollup experience that lets users switch between flat category detail and grouped macro views on the expense page, while keeping selection state consistent. This feature adds a client-side grouping layer, a canonical grouped selector UX, and shared primitives that later phases can reuse in analytics.

The intended result is a two-level hierarchy: Groups for overview, Categories for drill-down. The expense page becomes the canonical interaction surface, with grouped rollup visuals and a grouped filter control that do not require backend aggregation changes.

## Architecture decisions

1. **Reuse existing CategoryGroup schema.** No schema migration is required for Phase A/B because `CategoryGroup`, `CategoryGroupExpenseCategory`, and `CategoryGroupIncomeSource` already model the grouping domain.
2. **Compute rollups client-side for the expense page.** Grouped totals are derived from the flat expense breakdown plus the user’s group membership list, which keeps the first phase small and avoids backend churn.
3. **Keep the expense page as the canonical UX.** The expense page owns the grouped selector and rollup bar; analytics will later reuse the same interaction model instead of inventing a second grouping pattern.
4. **Thread group data through the existing expense page pipeline.** `ExpensePage -> ExpenseTableServer -> ExpenseTableClient -> widgets` keeps group state available without adding a new global store.
5. **Preserve selection state across view modes.** Switching between Categories and Groups must not reset selected categories, or the user loses context while comparing macro and micro views.
6. **Represent ungrouped categories explicitly.** Categories without a group collapse into a synthetic `Ungrouped` bucket so totals always reconcile and unassigned categories remain visible.
7. **Use grouped filter controls instead of chip-heavy selectors.** The grouped selector should support fast search/toggle behavior and avoid showing redundant selected chips inside the rollup panel.

## Data model changes

| Area | Change |
|---|---|
| Prisma schema | No change for Phase A/B |
| Category groups | Existing models are reused as-is |
| Rollup data | Derived client-side from `CategoryBreakdown[]` + `CategoryGroupListItem[]` |

## Component and service changes

| Surface | Change |
|---|---|
| `src/lib/category-group-utils.ts` | Shared grouping helpers for breakdowns and entries |
| `src/app/(authorized)/cashflow/expense/page.tsx` | Fetch and pass `categoryGroups` |
| `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` | Forward group props to the client table |
| `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Own shared selection state and modal wiring |
| `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx` | Render flat/grouped modes and filter UI |
| `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` | Grouped monthly detail view |
| `src/components/ui/GroupCategoryPopover.tsx` | Per-group category drill-down popover |
| `src/components/ui/GroupedCategorySelect.tsx` | Grouped react-select filter control |

## Success criteria

| Outcome | Evidence |
|---|---|
| Grouped rollup totals reconcile with flat totals | Utility tests |
| Expense page receives user groups end-to-end | Type-safe prop threading |
| Users can switch Categories ↔ Groups without losing selection | UI state test |
| Ungrouped categories remain visible and counted | Grouping utility test |
| Grouped filter UX is the canonical control | Component test and browser review |

## Out of scope

| Item | Reason |
|---|---|
| Backend aggregated rollup APIs | Client-side grouping is enough for Phase A/B |
| User-defined group colors | Not needed for the first reviewable slice |
| Income group rollup | Separate follow-up slice |
| Trend charts by group | Later analytics phase |
| Mobile-specific layout tuning | Desktop-first review slice |
