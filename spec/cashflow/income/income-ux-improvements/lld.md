# Income UX Improvements — Low-Level Design

## Implementation Details
- Add advanced filtering, search, and batch edit/delete workflows to the income UI.
- Improve accessibility with stronger ARIA labels, keyboard navigation, and clearer focus behavior.
- Refactor the table layer toward TanStack Table-style typed columns and reusable controls.
- Add category visualization and summary widgets without changing the underlying CRUD contract.
- Keep enhancements layered on top of income-management so feature ownership stays clear.

## ✅ IMPLEMENTED: Month → Transaction Ledger Drill-Down (2026-05-31)

Each month accordion header in the income table now includes a link to the transaction ledger pre-filtered to that month and year, with the `income` tab pre-selected.

### Navigation Pattern
- **URL**: `/cashflow/transactions?month={M}&year={YYYY}&tab=income`
- **Month/Year**: parsed from the accordion's `monthKey` prop (format `YYYY-MM`)
- **Tab**: `income` pre-selects the CREDIT transaction view in the ledger
- **Visual**: `ExternalLink` icon (lucide-react) in the header right section, alongside the monthly subtotal

### Component Changes
- `MonthAccordionPanel.tsx` — header restructured from single `<button>` to `<div>` + toggle `<button>` + `<Link>`. Avoids nested interactive elements. Link uses `next/link` for client-side navigation.

### Test Coverage
- `src/__tests__/unit/IncomeTableClient.monthHeader.test.tsx` — 6 tests covering: month label render, flex layout, subtotal display, entry count badge, ledger link href for Jan (month=1), ledger link href for Jul (month=7).

## File Inventory

| File | Status | Role |
|------|--------|------|
| `src/app/(authorized)/cashflow/income/_components/MonthAccordionPanel.tsx` | ✅ BUILT | Accordion panel per month — now includes ledger drill-down link |
| `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx` | ✅ BUILT | Renders MonthAccordionPanel list with groupByMonth |
| `src/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget.tsx` | ✅ BUILT | Source breakdown visualization |
| `src/__tests__/unit/IncomeTableClient.monthHeader.test.tsx` | ✅ BUILT | Tests for accordion header including ledger link |
| `src/app/(income)/_components/IncomeFilters.tsx` | ❌ NOT BUILT | Advanced filtering controls (future) |
| `src/app/(income)/_components/IncomeBatchActions.tsx` | ❌ NOT BUILT | Batch actions surface (future) |