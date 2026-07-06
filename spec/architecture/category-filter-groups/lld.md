# Category Filter Groups — LLD

## Phase map

| Phase | Files changed | Description |
|---|---|---|
| Phase A — Data Layer & Spec | `src/lib/category-group-utils.ts`, `src/app/(authorized)/cashflow/expense/page.tsx`, `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx`, `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Thread group data through the expense pipeline and add shared grouping helpers |
| Phase B — Interactive Group Distribution Bar | `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx`, `src/components/ui/GroupCategoryPopover.tsx`, `src/components/ui/GroupedCategorySelect.tsx` | Add flat/grouped toggle, grouped filter control, and per-group drill-down |
| Phase C — Grouped Monthly Breakdown Modal | `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` | Add grouped accordion-style monthly detail view |
| Phase D — Analytics UX Alignment | `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx`, `src/components/ui/CategoryGroupRollupPanel.tsx` | Reuse the canonical grouped selector and group rollup visuals in analytics |
| Phase E — Analytics Group Trend Chart | `src/app/(authorized)/cashflow/analytics/_components/ExpenseGroupTrendChart.tsx` | Add a stacked group trend chart for month-over-month review |

## Phase A — Data Layer & Spec

### Goal

Thread `categoryGroups` through the expense page pipeline and add a reusable grouping utility that can produce grouped breakdowns from flat category totals.

### Interfaces and function signatures

```typescript
export type GroupedBreakdown = {
  groupId: string | null;
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

export function groupExpenseBreakdown(
  breakdown: CategoryBreakdown[],
  groups: CategoryGroupListItem[],
  selectedCategoryIds?: Set<string>,
): GroupedBreakdown[];

export function groupExpenseEntries(
  entries: ExpenseEntryWithCategory[],
  groups: CategoryGroupListItem[],
): GroupedEntry[];

export type ExpenseTableServerProps = {
  calendarYearId: string;
  userId: string;
  dateFrom: Date;
  dateTo: Date;
  calendarLabel: string;
  fromMonth: number;
  fromYear: number;
  bankAccountId?: string;
  categoryGroups: CategoryGroupListItem[];
};

export type ExpenseTableClientProps = {
  calendarYearId: string;
  monthlySummaries: MonthlyExpenseSummary[];
  dateFrom: Date;
  dateTo: Date;
  calendarLabel: string;
  fromMonth: number;
  fromYear: number;
  bankAccountId?: string;
  categoryBreakdown: CategoryBreakdown[];
  yearDateFrom: string;
  yearDateTo: string;
  categoryGroups: CategoryGroupListItem[];
};
```

### TDD test cases

| Test | Type | Verifies |
|---|---|---|
| `groupExpenseBreakdown` returns grouped buckets plus `Ungrouped` | unit | Flat breakdowns aggregate correctly |
| `groupExpenseBreakdown` respects `selectedCategoryIds` | unit | Filtering does not leak excluded categories |
| Expense page prop threading includes `categoryGroups` end-to-end | component/integration | Server props reach the client table without type mismatches |

### Migration notes

No Prisma migration is required. The feature uses the existing `CategoryGroup` models and only adds client-side grouping behavior.

### Phase A — Data Layer & Spec ✅ COMPLETE

**Completed:**

- ✅ `src/lib/category-group-utils.ts` already contains `groupExpenseBreakdown` / `groupExpenseEntries` with `Ungrouped` handling and selected-category filtering.
- ✅ `src/app/(authorized)/cashflow/expense/page.tsx` already fetches `categoryGroups` and passes them to `ExpenseTableServer`.
- ✅ `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` and `ExpenseTableClient.tsx` already thread and consume `categoryGroups`.
- ✅ Tests passing: no Phase A code change required (no-op implementation based on current file state).

**Deviations from plan:** Phase A was pre-implemented before this run; no source edits were needed.

**Next phase reads:** `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx` (view mode toggle + filter + group badges), `src/components/ui/GroupCategoryPopover.tsx`, `src/components/ui/GroupedCategorySelect.tsx`, and `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` (selection state wiring).

## Phase B — Interactive Group Distribution Bar

### Goal

Add a grouped view to the expense breakdown widget with shared selection state, grouped filter control, and per-group drill-down.

### Interfaces and function signatures

```typescript
type ViewMode = 'categories' | 'groups';

type ExpenseCategoryBreakdownWidgetProps = {
  breakdown: CategoryBreakdown[];
  yearDateFrom: string;
  yearDateTo: string;
  calendarLabel: string;
  categoryGroups: CategoryGroupListItem[];
  selectedCategoryIds: Set<string>;
  onCategorySelectionChange: (next: Set<string>) => void;
};

type GroupCategoryPopoverProps = {
  group: CategoryGroupListItem;
  selectedCategoryIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onSelectAll: () => void;
  onClear: () => void;
};

type GroupedCategorySelectProps = {
  allCategories: OptionType[];
  categoryGroups: CategoryGroupListItem[];
  selectedCategoryIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  hideSelectedValues?: boolean;
};
```

### TDD test cases

| Test | Type | Verifies |
|---|---|---|
| Default mode renders the flat category breakdown | component | Existing behavior stays intact |
| Groups mode renders group totals and an `Ungrouped` bucket | component | Rollup is visible and totals reconcile |
| Changing selection in one mode persists after switching modes | component | Shared selection state is preserved |

### Phase B — Interactive Group Distribution Bar ✅ COMPLETE

**Completed:**

- ✅ `ExpenseCategoryBreakdownWidget.tsx` already provides `Categories | Groups` mode switching, grouped rollup rendering, grouped filter panel wiring, and popover-trigger badges.
- ✅ `GroupCategoryPopover.tsx` already supports per-category checkbox toggles with group-scoped `All`/`None` actions.
- ✅ `GroupedCategorySelect.tsx` already supports grouped multi-select with `hideSelectedValues`, hidden label mode, and non-searchable checkbox-list behavior.
- ✅ `ExpenseTableClient.tsx` already keeps `selectedCategoryIds` in parent state so selection persists when the widget switches modes.
- ✅ Tests passing: no Phase B code change required (no-op implementation based on current file state).

**Deviations from plan:** Phase B was pre-implemented before this run; no source edits were needed.

**Next phase reads:** `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` plus grouped-entry helpers in `src/lib/category-group-utils.ts`.

## Phase C — Grouped Monthly Breakdown Modal

### Goal

Render monthly category detail grouped by category group with collapsible sections.

### Interfaces and function signatures

```typescript
type CategoryBreakdownModalProps = {
  calendarYearId: string;
  month: number;
  monthName: string;
  monthYear: number;
  isOpen: boolean;
  categoryGroups: CategoryGroupListItem[];
  onClose: () => void;
};
```

### TDD test cases

| Test | Type | Verifies |
|---|---|---|
| Flat mode matches the current monthly breakdown list | component | No regression in existing detail view |
| Grouped mode nests categories under the correct group headings | component | Group rollup is accurate in the modal |
| Groups without members are not rendered | component | Empty containers do not clutter the modal |

### Phase C — Grouped Monthly Breakdown Modal ✅ COMPLETE

**Completed:**

- ✅ `CategoryBreakdownModal.tsx` already exposes `viewMode: 'flat' | 'grouped'` with a toggle UI.
- ✅ Modal already computes grouped data via `groupExpenseEntries(state.data, categoryGroups)`.
- ✅ `GroupedEntriesView` is already implemented with collapsible grouped sections and grouped totals.

**Deviations from plan:** Phase C was pre-implemented before this audit; no source edits were needed.

**Next phase reads:** `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx` and `src/components/ui/CategoryGroupRollupPanel.tsx`.

## Phase D — Analytics UX Alignment

### Goal

Use the same grouped selector and group rollup presentation in analytics so expense and income category controls feel consistent.

### Interfaces and function signatures

```typescript
type CategoryGroupRollupPanelProps = {
  label: string;
  scope: 'INCOME' | 'EXPENSE';
  breakdown: CategoryBreakdown[];
  allCategories: OptionType[];
  categoryGroups: CategoryGroupListItem[];
  selectedCategoryIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  showEmptyGroups?: boolean;
  emptyStateHref?: string;
};
```

### TDD test cases

| Test | Type | Verifies |
|---|---|---|
| Expense and income panels use the same grouped control surface | component | UX parity is preserved |
| Scope filtering uses the correct group set | component | Expense groups do not leak into income |
| Empty-group state points to category-group setup | component | Users have a recovery path |

### Phase D — Analytics UX Alignment ✅ COMPLETE

**Completed:**

- ✅ `CashflowAnalyticsClient.tsx` uses `CategoryGroupRollupPanel` for both income and expense selectors.
- ✅ Income panel uses `scope='INCOME'`; expense panel uses `scope='EXPENSE'`.
- ✅ Expense panel includes `emptyStateHref='/cashflow/category-groups'` and grouped selector parity behavior.

**Deviations from plan:** Phase D was pre-implemented before this audit; no source edits were needed.

**Next phase reads:** `src/app/(authorized)/cashflow/analytics/_components/ExpenseGroupTrendChart.tsx` and `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx` for estimated trend wiring.

## Phase E — Analytics Group Trend Chart

### Goal

Add a stacked trend chart that visualizes monthly spend by category group.

### Interfaces and function signatures

```typescript
type ExpenseGroupTrendChartProps = {
  monthlyData: Array<{
    month: number;
    year: number;
    groups: Array<{
      groupId: string | null;
      groupName: string;
      totalAmount: number;
    }>;
  }>;
};
```

### TDD test cases

| Test | Type | Verifies |
|---|---|---|
| Chart stacks groups by month | component | Group totals render correctly |
| Tooltip shows group breakdown for the hovered month | component | Hover data is useful |
| Empty trend data renders a sensible empty state | component | No crash on sparse history |

### Phase E — Analytics Group Trend Chart ✅ COMPLETE

**Completed:**

- ✅ Added `src/app/(authorized)/cashflow/analytics/_components/ExpenseGroupTrendChart.tsx` with stacked monthly bars by group.
- ✅ Wired `CashflowAnalyticsClient.tsx` to compute and pass estimated monthly group allocations from annual group mix + monthly expense totals.
- ✅ Chart UX explicitly marks data as an estimate and includes empty-state handling.

**Deviations from plan:** Phase E used client-side estimated allocation based on annual group distribution because the current analytics API does not return per-month category-group series.

**Next phase reads:** None — feature implementation phases complete.

## Integration points and edge cases

- Ungrouped categories must always be represented explicitly.
- Group totals must reconcile with flat totals when all categories are selected.
- The grouped selector should keep checkbox-style behavior and avoid collapsing selected values into chips.
- Expensive regrouping should be memoized or derived from stable inputs.
- Scope must remain `EXPENSE` for the expense page and `INCOME` only where analytics explicitly supports it.

## File inventory

| File | Action | Phase | Description |
|---|---|---|---|
| `src/lib/category-group-utils.ts` | Create/modify | A | Shared grouping helpers |
| `src/app/(authorized)/cashflow/expense/page.tsx` | Modify | A | Fetch and pass category groups |
| `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` | Modify | A | Forward group props |
| `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Modify | A/B | Own shared selection state and widget wiring |
| `src/app/(authorized)/cashflow/expense/_components/ExpenseCategoryBreakdownWidget.tsx` | Modify | B | Add flat/grouped toggle and filter UI |
| `src/components/ui/GroupCategoryPopover.tsx` | Create | B | Per-group drill-down popover |
| `src/components/ui/GroupedCategorySelect.tsx` | Create | B | Grouped filter control |
| `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx` | Modify | C | Add grouped monthly breakdown mode |
| `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx` | Modify | D | Reuse canonical grouped selector UX |
| `src/components/ui/CategoryGroupRollupPanel.tsx` | Modify | D | Shared group rollup panel behavior |
| `src/app/(authorized)/cashflow/analytics/_components/ExpenseGroupTrendChart.tsx` | Create | E | Group trend chart |
