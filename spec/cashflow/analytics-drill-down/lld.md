> ✅ IMPLEMENTED — 2026-05-29

# Analytics Drill-Down — Low-Level Design (LLD)

## Phase Map

| Phase | Files Changed | Description |
|-------|--------------|-------------|
| P1    | `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx` | Refactor filter bar to horizontal, full-width layout |
| P2    | `src/app/(authorized)/cashflow/analytics/_components/AnalyticsDrillDownDrawer.tsx` (create), `CashflowAnalyticsClient.tsx`, `ExpenseCategoryChart.tsx`, `IncomeSourceChart.tsx`, `src/server/trpc/router/transaction.ts` | Implement right-side drawer for drill-down, update chart click handlers, ensure tRPC procedure supports filtered queries |

## Interfaces & Schemas

### Drawer Props
```typescript
export interface AnalyticsDrillDownDrawerProps {
  open: boolean;
  onClose: () => void;
  filter: {
    type: 'category' | 'source' | 'month';
    value: string;
    label: string;
    month?: number;
    year?: number;
  };
}
```

### tRPC Procedure Signature
```typescript
// src/server/trpc/router/transaction.ts
getTransactionsByFilter: publicProcedure
  .input(z.object({
    categoryId: z.string().optional(),
    source: z.string().optional(),
    month: z.number().optional(),
    year: z.number().optional(),
    accountId: z.string().optional(),
  }))
  .query(async ({ ctx, input }) => { /* ... */ })
```

## TDD Test Cases

| Test | Type | Verifies |
|------|------|----------|
| Filter bar renders full-width, not stacked | UI | Layout is horizontal and responsive |
| Clicking category opens drawer with correct transactions | UI/Integration | Drawer opens, shows filtered transactions |
| Drawer supports dark mode | UI | All elements have dark: variants |
| Drawer "View all" link navigates to correct Transactions page | UI | Link includes correct query params |
| tRPC procedure returns correct filtered transactions | API | Filtering logic matches UI selection |

## Migration Notes
- No schema changes; no migration required.

## Integration Points & Edge Cases
- Drawer must close on overlay click or Escape key
- If no transactions found, show empty state
- Ensure only one drawer open at a time
- Chart click must pass correct filter (categoryId/source/month)
- Drawer must not break analytics-dashboard or other drawers

## Implementation Summary

- `src/app/(authorized)/cashflow/analytics/_components/AnalyticsDrillDownDrawer.tsx` — CREATED
- `src/server/trpc/router/category-transactions.ts` — MODIFIED (added `getForPeriod`)
- `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx` — MODIFIED (drillDownFilter state + drawer integration)

## File Inventory

| File | Action | Description |
|------|--------|-------------|
| `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx` | MODIFY | Refactor filter bar, update click handlers |
| `src/app/(authorized)/cashflow/analytics/_components/AnalyticsDrillDownDrawer.tsx` | CREATE | New drawer component for filtered transactions |
| `src/app/(authorized)/cashflow/analytics/_components/ExpenseCategoryChart.tsx` | MODIFY | Pass categoryId to click handler |
| `src/app/(authorized)/cashflow/analytics/_components/IncomeSourceChart.tsx` | MODIFY | Pass source to click handler |
| `src/server/trpc/router/transaction.ts` | MODIFY | Add/extend procedure for filtered transactions |
