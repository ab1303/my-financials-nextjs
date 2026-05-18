# Income UX Improvements — High Level Design

## Problem & Proposed Solution

The `/cashflow/income` page presents a flat chronological list of income entries
with no grouping, plain-text source labels, inconsistent decimal formatting, and
a total figure that is visually disconnected from the data. Users who earn from
multiple sources (Employment, Stocks, Dividends, Other) cannot understand their
fiscal-year composition at a glance — they must scroll, mentally tally, and
navigate to a separate report page for any breakdown.

The proposed improvements are entirely in the rendering/UX layer: no schema
changes, no new API endpoints, no new server actions. The changes add (1)
color-coded source badges in the table, (2) a compact source breakdown widget
derived from already-loaded data, (3) monthly grouping with subtotal rows, and
(4) a number of polish fixes (decimal formatting, section heading style). The
goal is to make the income CRUD page self-sufficient for the "manage and
understand" flow.

---

## Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **No new data fetching** — derive breakdown from `data[]` already in `StateProvider` | Avoids latency, extra tRPC call, and cache complexity. The full year's entries are already loaded. |
| 2 | **Monthly grouping via pre-processing, not TanStack `groupingRowModel`** | TanStack group-by changes row indices, which breaks the `editedRows: Map<number, ...>` inline-edit contract. Safer to split `data[]` into month buckets and render separator `<tr>` rows manually. |
| 3 | **Source color map is static and client-side** | `IncomeSource.name` values are seeded system data (`Employment`, `Stocks`, `Dividend`, `Other`, `Rental`, `Business`, `Interest`). A static `Record<string, string>` in the badge component is sufficient; unknown values fall back to a neutral style. |
| 4 | **`SourceBadge` and `SourceBreakdownWidget` live in `_components/`** | Co-located within the income feature directory. Neither is used outside this route, so no promotion to `src/components/` is needed. |
| 5 | **Section heading promoted from monospace `<div>` to proper `<h2>`** | The current `font-mono text-muted-foreground` label reads as developer debug text. It should use the page heading hierarchy and be visually prominent. |
| 6 | **`NumericFormat` decimal fix is applied at the `TableCell` meta level** | The `AMOUNT` cell type in `columns.tsx` passes `meta: { type: 'AMOUNT' }` to the shared `TableCell` renderer. Fix `decimalScale={2} fixedDecimalScale` there to fix all amount cells across the table in one place. |
| 7 | **Source breakdown widget is read-only** | It is a compact informational widget, not interactive. No click-to-filter behaviour in this phase. |

---

## Data Model Changes

**None.** All changes are in the presentation layer.

---

## Component / Service Changes

### New components

| Component | Props | Responsibility |
|-----------|-------|---------------|
| `SourceBadge` | `sourceName: string` | Renders a color-coded pill/chip for a given income source name |
| `SourceBreakdownWidget` | `entries: IncomeEntryType[]` | Computes per-source totals and percentages from entries; renders a compact bar with labelled segments |

### Modified components

| Component | Change |
|-----------|--------|
| `columns.tsx` — `incomeSourceName` cell | Replace `TableCell` with `SourceBadge` |
| `IncomeTableClient.tsx` | Wrap TanStack rows in monthly group buckets; add `SourceBreakdownWidget` above the `<Table>` |
| `form.tsx` | Fix section heading style; fix `NumericFormat` `decimalScale` on Total Earned |
| `page.tsx` | Remove orphaned `font-mono` label for `{selectedCalendarYear.description} Income` (now the heading in `IncomeTableClient`) |

---

## Success Criteria

| # | Criterion | Verifiable by |
|---|-----------|---------------|
| 1 | Each row's income source displays as a color-coded badge, not plain text | Visual inspection |
| 2 | Rows are grouped by month with a header row showing month name and subtotal | Visual inspection |
| 3 | A source breakdown widget above the table shows each source's % of total for the selected year | Visual inspection |
| 4 | All monetary amounts show exactly 2 decimal places (e.g. `$15.80`, not `$15.8`) | Visual inspection |
| 5 | Section label is a styled heading, not monospace debug text | Visual inspection |
| 6 | Inline edit (add, edit, delete row) still works correctly after monthly grouping change | Manual test: add new entry, edit, delete |
| 7 | Dark mode renders all new badges and widgets correctly | Visual inspection with dark mode enabled |
| 8 | No TypeScript errors — `pnpm run build` passes | CI build |

---

## Out of Scope / Future Phases

| Item | Reason deferred |
|------|----------------|
| Chart/graph visualization (bar chart, pie chart) | Requires adding a chart library; higher effort, separate PO decision |
| Click-to-filter by source from the breakdown widget | Adds state complexity; nice-to-have Phase 2 |
| Collapsible month groups | Added interaction complexity; low priority for initial improvement |
| Source color customisation per user | Over-engineering for a static source list |
| Pagination of the income table | Not needed at typical volumes per fiscal year |
| Export to CSV | Separate feature domain |

---

## Phase 2 Fixes (post-review)

After Phase 1 implementation review against the live UI, three issues were identified:

### Fix 1 — `Other` / fallback badge dark mode contrast
`dark:bg-gray-700/40 dark:text-gray-300` renders as a near-invisible dark-on-dark badge in dark mode.
Fix: use `dark:bg-gray-600/60 dark:text-gray-100` for sufficient contrast.

### Fix 2 — Amount column right-alignment
Currency amounts are left-aligned, making vertical comparison hard.
Fix: add `text-right` to the AMOUNT column header and read-only cell renderer, and to `THeadTH` when `meta.align === 'right'`.

### Fix 3 — Month header row layout broken by `<span>` wrapper
`TBodyTD` wraps all children in `<span className='text-sm text-foreground'>`, which prevents the `flex justify-between` month header layout from working. Additionally `TBodyTR` accepts no `className` prop so row-level background cannot be set.
Fix: render month header rows as raw `<tr><td>` (bypassing `Table.TBody.TR/TD`) to avoid the span wrapper and enable proper row-level styling.
