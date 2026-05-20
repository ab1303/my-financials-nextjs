# Interest Cleansing — LLD

## Implementation Details
- Implements CRUD for InterestCleansingRecord via tRPC routers.
- Uses Prisma for persistence; Zod for validation.
- UI: Server Component for data fetching, Client Wrapper for interactivity (add/edit/delete/mark as cleansed).
- Integrates with income and expense modules for reporting.
- All monetary values handled as integer cents.

## File Inventory
- `src/server/api/interestCleansing.ts` — tRPC router
- `src/prisma/schema.prisma` — InterestCleansing model
- `src/app/(interest-cleansing)/` — Server/Client Components
- `src/types/interestCleansing.ts` — Shared types
- `src/utils/validation.ts` — Zod schemas
