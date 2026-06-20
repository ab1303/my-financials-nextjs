Low-Level Design: Category Groups Authoring & Analytics Linking

Purpose
- Provide implementation details, component contracts, API contracts, tests, and files to change so an implementer (or sub-agent) can complete the feature.

Scope of this LLD
- Define the persistence data model for user-owned category groups.
- Category groups are persisted per user and per category domain, then used by the authoring dashboard and the analytics grouped category filter surface.
- The authoring page is the first phase and must land before the analytics filter refinement phase.
- Base the grouped-category interactions on the shared `react-select` wrapper/styles rather than a bespoke checkbox panel.

Wireframe / UX direction
- Use the same page-shell pattern as `Bank Interest` / `Category Rules`: title, short description, and a primary action on the right.
- Landing view is a dashboard of existing category groups split into two sections: `Income` and `Expense`.
- Each section renders group cards with name, member count, and edit/delete actions.
- The `+` button opens a right-side drawer for create/edit.
- The drawer contains: scope select (`Income Sources` vs `Expense Category`), group name input, selectable source/category list, and save/cancel actions.
- On Analytics, render grouped category selectors using `react-select`.
- Categories should be presented under their authored group headings, with uncategorized items collected under a single `Ungrouped` section.
- Those selectors feed page-level calculations and should update totals, rollups, summaries, and graphs.

Files to add/update
- `src/layouts/SideNav.tsx`
- `src/app/(authorized)/cashflow/category-groups/page.tsx`
- `src/app/(authorized)/cashflow/category-groups/_components/CategoryGroupsDashboard.tsx`
- `src/app/(authorized)/cashflow/category-groups/_components/CategoryGroupCard.tsx`
- `src/app/(authorized)/cashflow/category-groups/_components/CategoryGroupsDrawer.tsx`
- `src/server/services/category-groups/category-groups.service.ts`
- `src/server/trpc/router/category-groups.ts`
- `src/server/trpc/router/_app.ts`
- `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx`
- `src/components/ui/filters.tsx`
- `src/hooks/useCategoryFilters.ts`
- `src/lib/mockFilterData.ts`
- `src/components/filters/FiltersPanel.stories.tsx`
- `src/components/ui/index.ts`
- `src/__tests__/unit/SideNav.test.tsx`
- `src/__tests__/unit/CategoryGroupsDashboard.test.tsx`
- `src/__tests__/unit/CategoryGroupsDrawer.test.tsx`
- `src/__tests__/unit/CategoryGroupsPage.test.tsx`
- `src/__tests__/unit/category-groups.service.test.ts`
- `src/__tests__/unit/category-groups.router.test.ts`
- `src/__tests__/unit/AnalyticsFilters.test.tsx`

Component contracts
- CategoryGroupsPage
  - Loads the authenticated user’s groups and renders the dashboard shell.
  - Renders the `+` action and passes create/edit/delete handlers to the dashboard.

- CategoryGroupsDashboard
  - Props: `incomeGroups`, `expenseGroups`, `onCreate`, `onEdit`, `onDelete`
  - Behavior: grouped cards/sections, empty states, and action affordances.

- CategoryGroupCard
  - Props: `group`, `memberCount`, `scope`, `onEdit`, `onDelete`
  - UX: concise scan-first card with action buttons and metadata.

- CategoryGroupDrawer
  - Props: `mode: 'create' | 'edit'`, `group?`, `onSubmit`, `onCancel`
  - Behavior: scope select, name input, option list filtered by scope, and validation.

- Analytics grouped category selectors
  - Props: grouped category options, selected IDs, and change callbacks.
  - Behavior: react-select controls at the top of the page; options are grouped by authored group and an Ungrouped bucket; selections drive derived analytics state.

Types (TS)
- `type CategoryGroupScope = 'INCOME' | 'EXPENSE'`
- `type CategoryGroupItem = { id: string; name: string; color?: string }`
- `type CategoryGroup = { id: string; name: string; scope: CategoryGroupScope; items: CategoryGroupItem[] }`

Data model
- `enum CategoryGroupScope = { INCOME, EXPENSE }`
- `model CategoryGroup`
  - id, userId, scope, name, description?, createdAt, updatedAt
  - unique per user + scope + name
  - owns category link rows

- `model CategoryGroupExpenseCategory`
  - id, categoryGroupId, expenseCategoryId, createdAt, updatedAt
  - links a user-owned group to a global ExpenseCategory record

- `model CategoryGroupIncomeSource`
  - id, categoryGroupId, incomeSourceId, createdAt, updatedAt
  - links a user-owned group to a global IncomeSource record

Implementation notes
- The dashboard should derive its data from the persisted groups, not from the analytics filter state.
- Use the drawer as the single create/edit surface to avoid duplicating form logic.
- Keep delete actions explicit with confirmation.
- Analytics should remain server-authoritative for totals where possible, but the grouped category selectors may start with mock aggregation and then switch to the API-backed aggregator.

Testing
- Unit tests for the dashboard empty state, grouped sections, and action triggers.
- Unit tests for the drawer’s scope switching, item list rendering, and validation.
- Unit tests for analytics grouped-category selector wiring and derived totals/selection state.
- Existing `useCategoryFilters` tests remain relevant for the selector helpers and tri-state behavior.

Acceptance tests
- Category Groups appears under Transactions in the side nav.
- Landing page shows two dashboard sections: Income and Expense.
- Clicking `+` opens a drawer with scope select, item selection, and name input.
- Analytics page exposes grouped category selectors at the top.
- Analytics totals and graphs update when the selected categories change.
