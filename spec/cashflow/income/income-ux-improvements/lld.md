# Income UX Improvements — Low-Level Design

## Implementation Details
- Add advanced filtering, search, and batch edit/delete workflows to the income UI.
- Improve accessibility with stronger ARIA labels, keyboard navigation, and clearer focus behavior.
- Refactor the table layer toward TanStack Table-style typed columns and reusable controls.
- Add category visualization and summary widgets without changing the underlying CRUD contract.
- Keep enhancements layered on top of income-management so feature ownership stays clear.

## File Inventory
- `src/app/(income)/_components/IncomeTable.tsx` — enhanced income table.
- `src/app/(income)/_components/IncomeFilters.tsx` — filtering and search controls.
- `src/app/(income)/_components/IncomeBatchActions.tsx` — batch actions surface.
- `src/types/income.ts` — extended table/filter types.