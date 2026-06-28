# Category Group Rollup — Context

## Problem
The app has 23 expense categories with excellent granularity, but users see no macro-level rollup.
Opening the monthly breakdown presents a flat sorted list with no grouping signal.
Users cannot quickly answer "where is my money going?" at a high level.

## Domain Dependencies
- See `spec/architecture/category-filters/context.md` — category groups CRUD and data model
- See `spec/cashflow/categories/drill-down/context.md` — deep-link navigation from summaries
- `CategoryGroup`, `CategoryGroupExpenseCategory` models already persisted and serviceable
- `listCategoryGroups` service already returns `memberIds[]` per group

## IN Scope
- Annual distribution bar: "Categories | Groups" toggle with per-group sub-category popover
- Cross-group category selector (grouped react-select, same pattern as Analytics)
- Monthly breakdown modal: "Flat | Grouped" accordion toggle
- Group quick-filter chips with partial-selection badge
- All grouping is **client-side** (no new API endpoints required)

## OUT of Scope
- Backend group-aggregated totals
- User-defined group colors
- Group budget targets (budget vs. actual per group)
- Income group rollup
- Analytics Group Trend Chart (separate phase, lower priority)

## Key UX Patterns (from Mint, YNAB, Monarch Money, Copilot Money)
- Two-level hierarchy: Group (macro) ↔ Category (micro) with a toggle between them
- Click a group → drill into sub-categories; select/deselect individual items
- Shared selection state: chips, bar, and modal all reflect the same category selection
- Partial-selection badges: `Housing (1/3)` when only some sub-categories are active
