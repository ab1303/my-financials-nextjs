# Expense Tracking — LLD

## Implementation Details
- Implements CRUD for ExpenseEntry via tRPC routers.
- Uses Prisma for persistence; Zod for validation.
- UI: Server Component for data fetching, Client Wrapper for interactivity (add/edit/delete).
- Integrates with income management for reporting and analytics.
- All monetary values handled as integer cents.

## File Inventory
- `src/server/api/expense.ts` — tRPC router
- `src/prisma/schema.prisma` — Expense model
- `src/app/(expense)/` — Server/Client Components
- `src/types/expense.ts` — Shared types
- `src/utils/validation.ts` — Zod schemas
