# Category Group Rollup — LLD

## Purpose
Provide implementation detail so an agent can deliver client-side group rollup across the
Expense Tracking page: distribution bar and monthly breakdown modal.

## Files to Add / Change

### New
| File | Purpose |
|---|---|
| `src/lib/category-group-utils.ts` | `groupExpenseBreakdown()` and `groupExpenseEntries()` utilities |
| `src/components/ui/GroupCategoryPopover.tsx` | Per-group checkbox popover (click group → select sub-categories) |

### Modified
| File | Change |
|---|---|
| `src/app/(authorized)/cashflow/expense/page.tsx` | Fetch `categoryGroups` and pass as prop |
| `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` | Accept + forward `categoryGroups` |
| `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Add `categoryGroups` prop; lift `selectedCategoryIds` state; keep selection shared with the widget |
| `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx` | "Categories \| Groups" toggle; `GroupCategoryPopover` per group; "Filter ⚙" grouped react-select |
| `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` | "Flat \| Grouped" toggle; accordion grouped mode |

---

## Types

```ts
// src/lib/category-group-utils.ts

export type GroupedBreakdown = {
  groupId: string | null;   // null = Ungrouped
  groupName: string;
  totalAmount: number;
  percentage: number;
  categories: CategoryBreakdown[];
};

export type GroupedEntry = {
  groupId: string | null;
  groupName: string;
  totalAmount: number;
  entries: ExpenseEntryWithCategory[];
};
```

---

## Utility Functions

### `groupExpenseBreakdown(breakdown, groups)`
- Input: `CategoryBreakdown[]`, `CategoryGroupListItem[]` (scope=EXPENSE only)
- Output: `GroupedBreakdown[]` — groups aggregated + Ungrouped at the end
- Filter to `selectedCategoryIds` before computing if provided
- Sort groups by totalAmount desc

### `groupExpenseEntries(entries, groups)`
- Input: `ExpenseEntryWithCategory[]`, `CategoryGroupListItem[]`
- Output: `GroupedEntry[]` — groups aggregated + Ungrouped at the end
- Used in `CategoryBreakdownModal` grouped mode

---

## Component Contracts

### `ExpenseCategoryBreakdownWidget`
New props:
```ts
categoryGroups: CategoryGroupListItem[];
selectedCategoryIds: Set<string>;
onCategorySelectionChange: (ids: Set<string>) => void;
```
New local state:
```ts
viewMode: 'categories' | 'groups'  // default 'categories' when no groups; 'categories' otherwise
```
Behavior:
- Toggle pills above the bar: `[Categories] [Groups]`
- In **Groups mode**: pass `groupExpenseBreakdown(breakdown, groups)` to the bar; render group badges below bar
- Each group badge shows `GroupName $total (X%)` and a `▼` chevron
- Click badge → `GroupCategoryPopover` opens with checkboxes for that group's sub-categories
- "Filter ⚙" button → grouped react-select (reuse `SelectWrapper` with `GroupBase` options, same as Analytics `buildGroupedOptions`)
- Monthly expense totals update from the filtered summary endpoint when selected categories change
- If no groups defined → render empty state CTA linking to `/cashflow/category-groups`

### `GroupCategoryPopover`
```ts
type Props = {
  group: GroupedBreakdown;
  allCategories: CategoryBreakdown[];
  selectedCategoryIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
};
```
- Render as a `@headlessui/react` Popover or simple absolute-positioned div
- Checkbox list for each category in the group
- "Select all" / "Clear" quick actions
- Close on outside click

### `CategoryBreakdownModal` — Grouped Mode
New prop:
```ts
categoryGroups: CategoryGroupListItem[];
```
New local state:
```ts
viewMode: 'flat' | 'grouped'  // default 'flat'
```
Grouped mode renders:
```
▾ Housing                 $3,285  (39%)
    Home              $2,520  ↗
    Utilities           $498  ↗
    Insurance           $267  ↗

▾ Food & Dining           $2,545  (30%)
    Groceries          $1,766  ↗
    Eating out           $779  ↗

▾ Ungrouped               $2,506  (30%)
    Business             $544
    ...
```
- Accordion: `isOpen` per group (default open for top group, closed for rest)
- Group header: click to toggle
- Left color bar per group (same palette as distribution bar)
- Individual entries preserve existing edit/delete actions

---

## State Architecture

`selectedCategoryIds: Set<string>` is lifted to `ExpenseTableClient`:
- Initialised from all `categoryBreakdown[].categoryId` (all selected by default)
- Passed down to `ExpenseCategoryBreakdownWidget`
- `categoryBreakdown` filtered to `selectedCategoryIds` inside the widget and modal-aware surfaces
- Monthly summary totals are fetched from `/api/cashflow/expense/monthly-summary` when the selection is narrowed

---

## Acceptance Criteria

- [ ] "Categories | Groups" toggle visible on the distribution bar
- [ ] Groups mode shows group-level segments in the stacked bar
- [ ] Clicking a group badge opens a popover with checkboxes; bar updates on selection
- [ ] "Filter ⚙" opens grouped multi-select for cross-group selection
- [ ] Monthly table totals recalculate when the selected categories change
- [ ] Selection cleared → bar totals reflect only selected categories
- [ ] Monthly modal has "Flat | Grouped" toggle
- [ ] Grouped mode shows accordion groups with totals, collapsible sub-categories
- [ ] Empty state when no category groups exist (CTA to create groups)
- [ ] Dark mode: all new components have `dark:` variants
- [ ] Type-check and lint pass with zero new errors
