Feature Context: Category Grouping & Filters

Problem statement
- Users need to exclude categories (e.g., Investments, Transfers) from rollup totals to get meaningful operational views (income/expenses/net) — current summaries are inflated by categories that should not be counted.

Goals
- Let users group categories and include/exclude groups or individual categories from aggregation summaries.
- Make filters discoverable on all rollup pages, provide live preview of totals, and allow saving filter sets as "Saved Views".

User stories
- As a user, I can toggle a group to include/exclude all categories in that group and see totals update instantly.
- As a user, I can expand a group and include/exclude individual categories.
- As a user, I can save a filter set and restore it later.
- As a mobile user, I can open a bottom-sheet filter UI and perform the same actions.

UX flows
1. Open report/dashboard → left Filter Panel visible (desktop) or Filters FAB (mobile).
2. Toggle group checkbox (tri-state) or individual category checkboxes.
3. Preview Totals card updates immediately; hitting Save View persists selection.
4. Saved views are listed in panel header and can be applied or deleted.

Related pages / files (implementation hints)
- UI: src/components/ui/filters.tsx (FiltersPanel, GroupRow, CategoryItem, PreviewTotals)
- Example pattern: src/components/TransferExclusionSummary.tsx
- Shared UI tokens: src/components/ui/

Constraints
- Start with client-side mock aggregation for development. Server API contract must be defined and mocked; integration with real aggregator postponed until API exists.
- Accessibility: ARIA roles and indeterminate state required.
- Performance: preview updates should be debounced and memoized.

Acceptance criteria
- Group tri-state toggles behave correctly and are keyboard accessible.
- Preview Totals update within expected latency (<300ms for typical datasets).
- Saved views persist and restore filter state for the user.
