Feature Context: Category Grouping & Filters

Problem statement
- Users need a place to define reusable category groups before those groups can drive analytics rollups.
- Analytics summaries are currently inflated by categories that should not be counted, and the page does not yet expose group-based selectors.

Goals
- Add a `Transactions > Category Groups` page where users can create, edit, delete, and review category groups.
- Show a dashboard of existing `Income` and `Expense` groups on landing, with a primary `+` action to open a side drawer.
- Add top-of-page category filters on the Analytics page, sourced from the authored groups but presented as grouped category options.
- Make those category selections drive totals, rollups, summaries, and graphs across the page.
- Use the shared `react-select` baseline for the group selector UI so styling and accessibility match the rest of the app.
- Persist category groups per user against the existing `IncomeSource` and `ExpenseCategory` tables, allowing the same category to appear in multiple groups.

User stories
- As a user, I can open Transactions > Category Groups and see all of my existing income and expense groups.
- As a user, I can click `+` to create a new group in a side drawer, choose the group type, select items, and name the group.
- As a user, I can edit or delete an existing group from the dashboard.
- As a user, I can choose categories on Analytics and have those selections drive every chart and total.

UX flows
1. Open Transactions → Category Groups from the side nav.
2. Land on a dashboard of grouped sections for Income and Expense groups.
3. Click `+` to open a right-side drawer for create/edit.
4. Select `Income Sources` or `Expense Category`, pick the linked items, and name the group.
5. Open Analytics and choose categories from the top filter bar; those selections drive totals, rollups, and graphs.

Related pages / files (implementation hints)
- Authoring page: `src/app/(authorized)/cashflow/category-groups/page.tsx`
- Authoring shell: `src/app/(authorized)/cashflow/category-groups/_components/*`
- Side-nav entry: `src/layouts/SideNav.tsx`
- CRUD pattern reference: `src/app/(authorized)/cashflow/bank-interest/_components/cleanse-drawer/*`
- Analytics page shell: `src/app/(authorized)/cashflow/analytics/_components/CashflowAnalyticsClient.tsx`
- Grouped category selector UI: `src/components/ui/filters.tsx`
- Shared select baseline: `src/components/ui/Select/Select.tsx`, `src/lib/select-styles.ts`

Constraints
- The category-group authoring page is the first implementation phase and must land before analytics filter refinement work.
- Start with client-side grouped category aggregation for development. Server API contract must be defined and mocked; integration with real aggregator postponed until API exists.
- Accessibility: ARIA roles and indeterminate state required.
- Performance: preview updates should be debounced and memoized.

Acceptance criteria
- A Transactions nav item named Category Groups exists alongside Category Rules.
- The Category Groups dashboard shows existing Income and Expense groups with create/edit/delete actions.
- The Analytics page exposes grouped category selectors at the top of the page.
- Analytics totals, summaries, and graphs respond to the selected categories.
