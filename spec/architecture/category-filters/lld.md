Low-Level Design: Category Grouping & Filters

Purpose
- Provide implementation details, component contracts, API contracts, tests, and files to change so an implementer (or sub-agent) can complete the feature.

Scope of this LLD
- Implement UI components and client persistence + mocked aggregator endpoint. Do NOT change DB schema or run prisma migrations in this phase.
- Base the filter interactions on the shared `react-select` wrapper/styles rather than a bespoke checkbox panel.

Files to add (frontend)
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
  - Behavior: maintains selection map, exposes apply/save handlers, and renders react-select-driven group/category controls.

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

API contract (mock/production)
- POST /api/aggregates
  - Body: { includeCategoryIds?: string[], excludeCategoryIds?: string[] }
  - Response: { income: number, expense: number, net: number, groups: { [groupId]: { income:number, expense:number, net:number } } }
- GET /api/user/filter-views
  - Response: [{ id, name, selection: { [categoryId]: boolean }, createdAt }]
- PUT /api/user/filter-views/:id
  - Body: { name, selection }

Implementation notes
- useCategoryFilters hook
  - buildInitialSelection(groups) -> selection map
  - toggleCategory(id), toggleGroup(groupId, checked), clearSelection(), getActiveFilters()
  - tri-state helper: checkedCount vs total

- Preview totals
  - compute client-side from mock data for immediate UX; call POST /api/aggregates on Save or Apply (server authoritative)
  - debounce live previews (150ms)

Testing
- Unit tests for useCategoryFilters: initial state, toggling single, toggling group, indeterminate behavior
- Storybook story shows interactive panel and preview totals using the shared react-select baseline

Agent constraints (for sub-agents)
- CRITICAL SCOPE: Agent may ONLY modify files listed above. DO NOT run global formatting or autorewrite unrelated files.
- DO NOT run pnpm lint --fix or pnpm format in sub-agent steps.
- DO NOT change database schema or run prisma migration commands in this phase.

Deployment
- No backend migrations required for initial rollout. Switch mock aggregator to real API when endpoint is available and update LLD accordingly.

Acceptance tests
- Toggle group -> child checkboxes reflect change; indeterminate shows when partially selected
- Live preview reflects selection and matches POST /api/aggregates response when applied
- Saved view restores selection exactly

Notes for reviewers
- Validate ARIA attributes and keyboard navigation.
- Verify Storybook story covers desktop and mobile breakpoint behaviors.
