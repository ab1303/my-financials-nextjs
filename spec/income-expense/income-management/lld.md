# Income Management — LLD

## Implementation Details
- Implements CRUD for IncomeRecord via tRPC routers.
- Uses Prisma for persistence; Zod for validation.
- UI: Server Component for data fetching, Client Wrapper for interactivity (add/edit/delete).
- Integrates with expense and interest cleansing modules for reporting.
- All monetary values handled as integer cents.

## File Inventory
- `src/server/api/income.ts` — tRPC router
- `src/prisma/schema.prisma` — Income model
- `src/app/(income)/` — Server/Client Components
- `src/types/income.ts` — Shared types
- `src/utils/validation.ts` — Zod schemas
