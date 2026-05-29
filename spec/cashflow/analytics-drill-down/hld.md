# Cashflow Analytics Drill-Down — High-Level Design (HLD)

## Problem & Proposed Solution

The current Analytics page (/cashflow/analytics) suffers from two UX issues: (1) the filter bar is cramped and wastes horizontal space, and (2) clicking chart elements navigates away from the analytics context, disrupting user flow. Industry-standard apps keep drill-downs inline. The solution is to (1) refactor the filter bar to a full-width horizontal layout, and (2) replace navigation with a right-side drawer that displays filtered transactions inline, preserving context and improving discoverability.

## Architecture Decisions

1. **Drawer-based Drill-Down** — Clicking a chart element opens a right-side drawer (Monarch Money pattern) showing filtered transactions, maintaining analytics context and supporting multi-category exploration.
2. **Filter Bar Refactor** — The filter bar is restructured to a full-width horizontal layout using Tailwind CSS, improving usability and aesthetics.
3. **No Schema Changes** — All data fetching uses existing tRPC procedures and Prisma models; no database migrations are required.
4. **Client-Server Boundary** — The drawer is a Client Component that fetches transactions via tRPC, following the established Client Wrapper pattern for interactivity.
5. **Dark Mode Compliance** — All new/modified UI elements must support dark mode, following the established AppSelect/react-select dark mode patterns.
6. **Escape Hatch Navigation** — The drawer includes a "View all in Transactions ↗" link for users needing the full ledger view.
7. **Recharts Integration** — Chart click handlers are updated to pass the correct identifiers and open the drawer, not navigate.

## Data Model Changes (Schema Diff)

- **None.** This feature is a pure UI/UX improvement. No changes to Prisma models or database schema.

## Component/Service Changes (High-Level)

- Refactor filter bar layout in `CashflowAnalyticsClient.tsx`.
- Add new `AnalyticsDrillDownDrawer.tsx` Client Component for filtered transaction display.
- Update chart components to open the drawer with correct filters.
- Update tRPC transaction procedure to support drawer queries if needed.

## Success Criteria

- Filter bar uses full-width horizontal layout, not stacked/left-aligned.
- Clicking a chart element opens a right-side drawer showing filtered transactions for the selected category/source/month.
- Drawer supports dark mode and matches existing drawer patterns.
- Drawer includes a "View all in Transactions ↗" link.
- No navigation away from analytics context on chart click.
- No database schema changes or migrations required.

## Out of Scope / Future Phases

| Area                        | In Scope | Out of Scope / Future Phase |
|-----------------------------|----------|----------------------------|
| Filter bar layout           | ✅       |                            |
| Drawer for drill-down       | ✅       |                            |
| Chart click navigation      | ✅       |                            |
| Multi-select drill-down     |          | ✅                         |
| Inline editing in drawer    |          | ✅                         |
| Custom transaction actions  |          | ✅                         |
| Analytics page redesign     |          | ✅                         |
| Mobile-specific optimizations|         | ✅                         |