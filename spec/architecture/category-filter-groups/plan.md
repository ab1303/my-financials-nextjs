# Plan: Category Filter Groups — PO Feature Utilization

## Problem Statement

The app has 23 expense categories with excellent granularity, but provides no macro-level rollup.
Users can't quickly answer "where is my money going?" at a high level.

Category Groups are already:

- Persisted in DB (`CategoryGroup`, `CategoryGroupExpenseCategory`, `CategoryGroupIncomeSource`)
- CRUD service fully implemented (`category-groups.service.ts`)
- Used in Analytics page filters (`CashflowAnalyticsClient.tsx` → `buildGroupedOptions`)
- CRUD UI page exists (`/cashflow/category-groups/`)

**Gap**: Groups are only used as multi-select filter grouping in Analytics. They are not used for rollup display, monthly breakdown visualization, or big-picture spending summaries.

---

## PO Recommendation: Competitive Research Insights

### Popular Finance Apps (Mint, YNAB, Monarch Money, Copilot Money, Personal Capital)

| Pattern                                             | Apps that use it           | Value                                 |
| --------------------------------------------------- | -------------------------- | ------------------------------------- |
| Dual-mode "Categories ↔ Groups" toggle              | Monarch Money, Copilot     | Instant macro/micro switch            |
| Accordion groups in monthly breakdown               | YNAB, Copilot              | Drill-down without leaving context    |
| Group-level stacked progress bar                    | Mint, Personal Capital     | Visual budget vs. actual per group    |
| Group color-coding with lighter sub-category shades | Copilot, Monarch           | Visual hierarchy and recognition      |
| Group quick-filter chips                            | Mint (budget section)      | Fast slice-and-dice                   |
| Group trend chart (group spend per month)           | Personal Capital (Empower) | Identifies seasonal spending patterns |

### Key Insight

The best apps expose a **two-level hierarchy**: Groups (macro) → Categories (micro). Users toggle between them based on context:

- _Month overview_ → Groups mode (fewer bars, clear picture)
- _Auditing a month_ → Category mode (granular detail)
- _Year-end review_ → Group trend chart (patterns over time)

---

## Feature Proposals (Prioritized)

### Feature 1 — Interactive Group Distribution Bar (Highest Impact)

**Where**: `ExpenseCategoryBreakdownWidget` on the Expense Tracking page
**Current**: 23-color stacked bar showing individual categories with "+23 more"
**Proposed**: Toggle pill "Categories | Groups" above the bar, with interactive sub-category selection.

#### Groups Mode — Click to Drill + Multi-select Sub-categories

- **Groups mode**: Merges categories by group membership, shows group totals
- Ungrouped categories collapse into a synthetic "Ungrouped" segment
- Bar segments colored per group; labels show group name + total + %
- **Click a group label/badge** → opens a popover/dropdown listing that group's categories with individual checkboxes
  - User can select/deselect individual sub-categories within the group
  - "Select all" / "Clear" actions per group
  - Bar and totals update reactively (debounced) as selection changes
- **"Filter" button** (top-right of the widget) opens a full grouped react-select multi-select — same grouped pattern as Analytics — for cross-group category selection
  - Categories are presented under their group headings; user can pick from any group in one control
- **Selection state is shared** between Categories and Groups modes — switching modes does not reset category selection

**UX flow**:

```
[Categories] [Groups]                        [Filter ⚙]
═══════════════════════════════════════════════════════
|   Housing 39%  |  Food 30%   |  Ungrouped 31%  |

Housing ▼  $3,285 (39%)   ← click ▼ → popover opens:
  ┌─────────────────────────────┐
  │ ☑ Home          $2,520      │
  │ ☑ Utilities     $498        │
  │ ☑ Insurance     $267        │
  │ [Select all]  [Clear]       │
  └─────────────────────────────┘

Food & Dining ▼  $2,545 (30%)
Ungrouped ▼  $2,506 (31%)
```

**Cross-group selection via Filter panel**:

```
[Filter ⚙] → opens grouped multi-select (react-select):
  Housing
    ✓ Home  ✓ Utilities  ✓ Insurance
  Food & Dining
    ✓ Groceries  ✓ Eating out & takeaway
  Ungrouped
    ✓ Business  ✓ Vehicle & transport  ...
```

- Empty state if no groups defined → CTA: "Create category groups to see rollup view"

### Feature 2 — Grouped Monthly Breakdown Modal

**Where**: `CategoryBreakdownModal` (opened from monthly table row)  
**Current**: Flat sorted list (Home, Groceries, Eating out, etc.)
**Proposed**: Add toggle "Flat | Grouped" at the top of the modal

- **Grouped mode**: Category entries nested under their group with group header + group total
- Group header shows: group name, group total $, percentage of monthly spend
- Group body: collapsible accordion showing individual categories
- Ungrouped categories under "Ungrouped" section at the bottom
- Visual: color-coded left border per group (same color as distribution bar)

**UX flow**:

```
Expenses for July 2025                   [Flat] [Grouped]

▾ 🏠 Housing                  $3,285.24  (39.4%)
     Home                      $2,520.00  ↗ Link
     Utilities                  $497.78   ↗ Link
     Insurance                  $267.46   ↗ Link

▾ 🛒 Food & Dining             $2,545.11  (30.5%)
     Groceries                 $1,766.18  ↗ Link
     Eating out & takeaway       $778.93  ↗ Link

▾ 📦 Ungrouped                 $2,505.93  (30.1%)
     Business                   $543.71
     ...

Total: $8,336.28
```

### Feature 3 — Canonical Grouped Selector UX

**Decision**: Keep the expense-page grouped selector as the canonical UX and align analytics to it.

- The expense page now has the stronger macro/micro flow: group rollup bar, group popover, and shared grouped multi-select.
- Analytics now uses the same rollup panel pattern for expense categories so the visuals and interaction stay aligned.
- This preserves a single mental model across the app and avoids two competing “group filter” interactions.

### Feature 3b — Remove Distribution/Filter Duplication (Visual Noise Fix) ✅

**Problem**: The multi-select chip box and the distribution badges show the same 23 categories simultaneously.
**Decision**: Hide the multi-select behind a compact **Filter** button; only show it when the user explicitly wants to change the selection.

- Default state: `[Categories|Groups]  [Filter]` → distribution bar + badges only
- Filter active: badge shows `4/23` count; clicking opens the multi-select inline
- Resetting: `All` button (only visible when filtered) restores full selection and collapses the filter
- Distribution badges are the primary UX; multi-select is the edit-mode control
- Apply to both `ExpenseCategoryBreakdownWidget` and `CategoryGroupRollupPanel`
- **Status: Complete** ✅

### Feature 3c — Chip-Free Filter Panel (Search-to-Toggle UX)

**Problem**: When Filter opens, react-select shows 23 chips for all selected categories — same visual noise, just one click deeper.
**Root cause**: `controlShouldRenderValue` defaults to `true`, so all selected items appear as chips in the control.
**Fix**: When used inside the rollup panel, suppress chips entirely. The control becomes a pure search input.

- Add `hideSelectedValues?: boolean` prop to `GroupedCategorySelect`
- When `true`: pass `controlShouldRenderValue={false}` to react-select → no chips shown
- Keep `hideSelectedOptions={false}` and `closeMenuOnSelect={false}` so the dropdown behaves like a true checkbox multi-select
- For these panels, set `isSearchable={false}` so the menu stays as a stable checkbox list instead of collapsing on text input
- Placeholder: `"Search categories..."`
- Remove the redundant `<Label>` ("Expense categories") — the Filter button already provides that label
- The dropdown retains grouped options with explicit checkbox affordances and persistent visibility of unchecked items
- Build filter options from a stable full category source (`expenseCategories`) rather than filtered analytics breakdown payloads
- Update both `CategoryGroupRollupPanel` and `ExpenseCategoryBreakdownWidget` to pass `hideSelectedValues`
- **Status: Complete** ✅

### Feature 3d — Analytics Income/Expense Panel Parity

**Problem**: Income and Expense panels diverged visually and behaviorally on Analytics.
**Fix**: Run both through the same rollup panel path.

- Add `scope` support to `CategoryGroupRollupPanel` (`INCOME` | `EXPENSE`) and use scope-specific groups
- Map analytics income source breakdown into rollup-compatible items (`categoryId/categoryName/amount/percentage`)
- Render Income categories with the same controls and rollup presentation as Expense categories
- **Status: Complete** ✅

### Feature 4 — Group Trend Chart on Analytics (Additive)

**Where**: `CashflowAnalyticsClient.tsx` — add as a new chart section below the existing filters
**Proposed**: Stacked bar chart showing monthly group-level expense over the fiscal year

- X-axis: months, Y-axis: expense total
- Each stack segment = one group (consistent color coding)
- Hover tooltip shows group breakdown per month
- Answers: "Is my Housing cost creeping up? Was December a Food splurge?"

---

## Spec Structure

New spec file: `spec/cashflow/categories/group-rollup/lld.md`
(Context already covered by `spec/architecture/category-filters/context.md`)

---

## Implementation Phases & Review Gates

> **Process rule**: Each phase ends with a UI/UX review gate. The next phase only starts after the user explicitly approves the outcome of the previous phase.

### Phase A — Data Layer & Spec (Prerequisite — no visual output)

- Create `spec/cashflow/categories/group-rollup/context.md` + `lld.md`
- Add `categoryGroups: CategoryGroupListItem[]` to `ExpensePage` server props
- Pass groups through `ExpenseTableServer` → `ExpenseTableClient` → widgets
- Create a `groupExpenseBreakdown(breakdown, groups)` utility in `src/lib/category-group-utils.ts`
  - Input: flat `CategoryBreakdown[]` + `CategoryGroupListItem[]`
  - Output: `GroupedBreakdown[]` = `{ groupId, groupName, totalAmount, percentage, categories: CategoryBreakdown[] }[]`
- **Gate**: type-check + lint pass; no visual review needed

### Phase B — Interactive Group Distribution Bar (Feature 1)

- Update `ExpenseCategoryBreakdownWidget` props to accept `categoryGroups`
- Add local state: `viewMode: 'categories' | 'groups'`, `selectedCategoryIds: Set<string>` (all by default)
- In groups mode: compute `GroupedBreakdown[]` from utility, filtered to `selectedCategoryIds`
- Group label/badge is clickable → opens a `GroupCategoryPopover` with per-category checkboxes
- "Filter ⚙" button opens a `GroupedCategorySelect` (react-select grouped, same pattern as Analytics)
- Selection state shared with filter chips (lifted to `ExpenseTableClient`)
- **🛑 Review Gate**: User reviews the distribution bar UX in browser before Phase C starts

### Phase C — Grouped Monthly Modal (Feature 2)

- Update `CategoryBreakdownModal` (the one inside `ExpenseTableClient`) to accept `categoryGroups`
- Add `viewMode` toggle state
- In grouped mode: group entries by group membership, render accordion UI
- Group totals computed from entries
- **🛑 Review Gate**: User reviews the monthly modal UX before Phase D starts

### Phase D — Align Analytics to Expense UX

- Update `CashflowAnalyticsClient.tsx` so expense categories use the same rollup panel pattern as the expense page
- Retain the expense-page grouped selector as the canonical interaction
- Reuse the shared grouped multi-select language and group rollup visuals instead of a page-specific variant
- **🛑 Review Gate**: User confirms the expense-page UX remains canonical before Phase E starts

### Phase E — Analytics Group Trend Chart (Feature 4)

- New `ExpenseGroupTrendChart` component in analytics
- Requires analytics API to return group-level monthly data (or compute client-side from existing data + groups)
- Lower priority; can be shipped independently
- **🛑 Review Gate**: User reviews chart UX

---

## Files to Add / Change

### New Files

- `src/lib/category-group-utils.ts` — grouping utility functions
- `src/components/ui/GroupCategoryPopover.tsx` — per-group checkbox popover (click on group in bar)
- `src/components/ui/GroupedCategorySelect.tsx` — grouped react-select multi-select (cross-group filter panel)
- `src/app/(authorized)/cashflow/analytics/_components/ExpenseGroupTrendChart.tsx`

### Modified Files

- `src/app/(authorized)/cashflow/expense/page.tsx` — fetch + pass categoryGroups
- `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` — forward groups prop
- `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` — keep canonical grouped selector UX
- `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx` — align expense category selection UX
- `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx` — dual-mode toggle
- `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` — grouped accordion mode

### Spec Files

- `spec/cashflow/categories/group-rollup/context.md` (new)
- `spec/cashflow/categories/group-rollup/lld.md` (new)

---

## Out of Scope (for this plan)

- Backend group-aggregated totals (use client-side grouping first)
- Group color management UI (user-defined colors per group)
- Group budget targets (budget vs. actual per group)
- Income group rollup (same pattern, separate implementation)
- Mobile/responsive breakpoints (assumes desktop-first)
