Low-Level Design: Category Grouping & Filters

Purpose
- Provide implementation details, component contracts, API contracts, tests, and files to change so an implementer (or sub-agent) can complete the feature.

Scope of this LLD
- Define the persistence data model for user-owned category groups.
- Category groups are persisted per user and per category domain, then used by the filter UI.
- Base the filter interactions on the shared `react-select` wrapper/styles rather than a bespoke checkbox panel.

Files to add/update
- prisma/schema.prisma
- prisma/migrations/<timestamp>_category_groups/migration.sql
- src/components/ui/filters.tsx  ← main feature component
- src/hooks/useCategoryFilters.ts (encapsulate selection logic & tri-state helpers)
- src/lib/mockFilterData.ts
- src/components/filters/FiltersPanel.stories.tsx
- src/components/ui/index.ts
- src/__tests__/unit/useCategoryFilters.test.ts
- src/__tests__/unit/FiltersPanel.test.tsx

Component contracts
- FiltersPanel
  - Props: groups: CategoryGroup[] (optional; default loads from API/mock)
  - Behavior: maintains selection map and renders react-select-driven group/category controls.

- GroupRow
  - Props: group: CategoryGroup
  - Props: selection: Record<string, boolean>
  - Callbacks: onToggleCategory(id), onToggleGroup(groupId, checked)
  - UX: show indeterminate state, checkedCount/total, and custom option styling that matches react-select.

- CategoryItem
  - Props: category: Category
  - Props: checked: boolean
  - Callback: onToggle(id)

Types (TS)
- type Category = { id: string; name: string; color?: string; type: 'income'|'expense'|'other'; }
- type CategoryGroup = { id: string; name: string; categories: Category[] }

Data model
- enum CategoryGroupScope = { INCOME, EXPENSE }
- model CategoryGroup
  - id, userId, scope, name, description?, createdAt, updatedAt
  - unique per user + scope + name
  - owns category link rows

- model CategoryGroupExpenseCategory
  - id, categoryGroupId, expenseCategoryId, createdAt, updatedAt
  - links a user-owned group to a global ExpenseCategory record
  - same expense category may belong to multiple groups
  - ownership flows through CategoryGroup.userId; link rows are pure associations

- model CategoryGroupIncomeSource
  - id, categoryGroupId, incomeSourceId, createdAt, updatedAt
  - links a user-owned group to a global IncomeSource record
  - same income source may belong to multiple groups
  - ownership flows through CategoryGroup.userId; link rows are pure associations

Implementation notes
- useCategoryFilters hook
  - buildInitialSelection(groups) -> selection map
  - toggleCategory(id), toggleGroup(groupId, checked), clearSelection(), getActiveFilters()
  - tri-state helper: checkedCount vs total

- Preview totals
  - compute client-side from mock data for immediate UX; call POST /api/aggregates when the backend aggregator exists (server authoritative)
  - debounce live previews (150ms)

- Persistence notes
  - category group membership is the source of truth for UI grouping
  - UI can derive tri-state group state from the persisted category-group links plus the current selection
  - scope validation must ensure expense groups only link ExpenseCategory rows and income groups only link IncomeSource rows

Testing
- Unit tests for useCategoryFilters: initial state, toggling single, toggling group, indeterminate behavior
- Storybook story shows interactive panel and preview totals using the shared react-select baseline

Agent constraints (for sub-agents)
- CRITICAL SCOPE: Agent may ONLY modify files listed above. DO NOT run global formatting or autorewrite unrelated files.
- DO NOT run pnpm lint --fix or pnpm format in sub-agent steps.
- DO NOT change database schema or run prisma migration commands until the schema phase is explicitly started.

Deployment
- No backend migrations required for initial rollout. Switch mock aggregator to real API when endpoint is available and update LLD accordingly.

Acceptance tests
- Toggle group -> child checkboxes reflect change; indeterminate shows when partially selected
- Live preview reflects selection and matches POST /api/aggregates response when applied

Notes for reviewers
- Validate ARIA attributes and keyboard navigation.
- Verify Storybook story covers desktop and mobile breakpoint behaviors.
