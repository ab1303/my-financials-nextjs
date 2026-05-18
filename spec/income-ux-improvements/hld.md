# Income UX Improvements — High Level Design

## Problem & Proposed Solution

The `/cashflow/income` page presents a flat chronological list of income entries
with no grouping, plain-text source labels, inconsistent decimal formatting, and
a total figure that is visually disconnected from the data. Users who earn from
multiple sources (Employment, Stocks, Dividends, Other) cannot understand their
fiscal-year composition at a glance — they must scroll, mentally tally, and
navigate to a separate report page for any breakdown.

Phases 1–7 delivered color-coded source badges, a source breakdown widget,
monthly grouping with subtotal rows in a flat table, and a suite of polish fixes.

Phase 8 replaces the flat grouped table with a **collapsible monthly accordion**.
On page load, all months are collapsed showing only the summary row (month name,
total, entry count). The user expands a month to view and manage its entries with
full inline-edit capability. This is a **summary-first, action-on-demand** UX
pattern: the page gives an instant income overview without requiring scroll, and
CRUD operations are scoped to the relevant month.

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
| 8 | **Phase 8: Accordion default-collapsed, multiple panels open simultaneously** | Default-collapsed gives an instant monthly summary at a glance. Allowing multiple open panels lets users compare entries across months or edit entries in two adjacent months without losing context. |
| 9 | **Phase 8: "Add Entry" scoped per expanded month panel; global fallback targets current month** | Scoping Add Entry to the panel makes the month explicit, eliminating a date-entry error class. The global button is a convenience fallback that auto-expands the current calendar month. |
| 10 | **Phase 8: `MonthAccordionPanel` receives a pre-sliced `entries` array and an `indexOffset`** | Each panel wraps its own TanStack table instance over its slice of `data[]`. `indexOffset` translates panel-local row indices back to the global `editedRows` Map keys, preserving inline-edit compatibility without a full refactor. |

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
| `MonthAccordionPanel` | `monthKey`, `label`, `subtotal`, `entries`, `indexOffset`, `addRow`, `editRow`, `deleteRow`, `calendarYearId` | Collapsible panel: summary header row (collapsed default) + expandable inline-edit TanStack table scoped to one month |

### Modified components

| Component | Change |
|-----------|--------|
| `columns.tsx` — `incomeSourceName` cell | Replace `TableCell` with `SourceBadge` |
| `IncomeTableClient.tsx` | Phase 5–7: wrap rows in monthly group buckets with raw `<tr>` separators. Phase 8: replace grouped table with `MonthAccordionPanel` list; move global "+ Add Entry" to current-month fallback |
| `form.tsx` | Fix section heading style; fix `NumericFormat` `decimalScale` on Total Earned |
| `page.tsx` | Remove orphaned `font-mono` label for `{selectedCalendarYear.description} Income` |

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
| 9 | On page load all month panels are collapsed; only summary row (month, total, count) is visible | Visual inspection |
| 10 | Clicking a month summary row expands it to reveal that month's entries with edit/delete actions | Manual test |
| 11 | Multiple month panels can be open simultaneously | Manual test: expand two panels |
| 12 | "+ Add Entry" within an expanded panel adds a new row scoped to that month | Manual test: add entry in Apr panel, verify dateEarned defaults to Apr |
| 13 | Global "+ Add Entry" auto-expands the current calendar month panel | Manual test |
| 14 | Inline edit (save/cancel/delete) continues to work correctly inside accordion panels | Manual test: edit, revert, delete inside expanded panel |

---

## Out of Scope / Future Phases

| Item | Reason deferred |
|------|----------------|
| Chart/graph visualization (bar chart, pie chart) | Requires adding a chart library; higher effort, separate PO decision |
| Click-to-filter by source from the breakdown widget | Adds state complexity; nice-to-have future phase |
| Source color customisation per user | Over-engineering for a static source list |
| Pagination of the income table | Not needed at typical volumes per fiscal year |
| Export to CSV | Separate feature domain |
| Drag-and-drop reorder of entries within a month | No ordering requirement in domain model |

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
