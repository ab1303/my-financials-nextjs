# Analytics Drill-Down — Context

## Problem Summary

The Analytics page's filter bar is cramped and wastes horizontal space, while clicking chart elements navigates away from the analytics context, disrupting user flow. Users expect to drill down into transactions inline, not via page navigation.

## Domain Dependencies
- See [spec/cashflow/hld.md](./hld.md) for Transaction, CategoryTaxonomy, FinancialAccount, and analytics data model definitions.
- Reuses tRPC, Prisma, and Next.js App Router patterns.

## Scope Boundary
**IN SCOPE:**
- Refactoring filter bar layout to horizontal, full-width
- Replacing chart click navigation with right-side drawer
- Drawer displays filtered transactions for category/source/month
- Drawer includes "View all in Transactions ↗" link
- Dark mode compliance for all new/modified UI
- Minor updates to chart click handlers
- tRPC procedure for filtered transactions (if needed)

**OUT OF SCOPE:**
- Multi-select drill-down
- Inline editing in drawer
- Analytics page redesign
- Mobile-specific optimizations
- Schema/database changes

## Schema References
- See [spec/cashflow/hld.md](./hld.md) for all relevant types (Transaction, CategoryBreakdown, SourceBreakdown, CashflowAnalyticsData).

## Existing Patterns to Reuse
- tRPC for data fetching (`import { trpc } from '@/server/trpc/client'`)
- Drawer UI pattern (see TransferLinkDrawer, CategoryRuleDrawer)
- Tailwind CSS + shadcn/ui components
- Client Wrapper pattern for interactive state

## Known Constraints / Gotchas
- No new schema/migrations allowed
- Drawer must support dark mode (see AppSelect/react-select pattern)
- Drawer is a Client Component; do not fetch data in Server Component
- Use URL search params for persistent drill-down state
- Do not break existing analytics-dashboard functionality
- All changes must be TypeScript-only, App Router only, no pages/ directory
