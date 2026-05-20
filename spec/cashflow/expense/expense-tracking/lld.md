# Expense Tracking — Low-Level Design

## Implementation Details
- Implement CRUD for `ExpenseEntry` via tRPC procedures backed by Prisma.
- Validate expense payloads with Zod and normalize money values consistently.
- Keep expense pages server-first, with client wrappers for inline editing, deletion, and drill-down UI.
- Support category and month-based analysis so expense totals can feed broader cashflow summaries.
- Preserve integration points used by reporting, analytics, and cashflow audit work.

## File Inventory
- `src/server/api/expense.ts` — expense router and CRUD procedures.
- `src/prisma/schema.prisma` — expense model definition.
- `src/app/(expense)/` — expense route server/client components.
- `src/types/expense.ts` — shared expense types.
- `src/utils/validation.ts` — expense validation schemas.