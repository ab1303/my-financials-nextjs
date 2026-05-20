# Income Management — Low-Level Design

## Implementation Details
- Implement CRUD for `IncomeRecord` via tRPC procedures backed by Prisma.
- Validate create/update payloads with Zod before persistence.
- Keep the page server-first for data loading, with a client wrapper for add/edit/delete interactions.
- Expose fiscal-year and date-scoped totals so income can participate in broader cashflow summaries.
- Preserve integer-cent handling or equivalent normalized money handling across mutations and aggregates.

## File Inventory
- `src/server/api/income.ts` — income router and CRUD procedures.
- `src/prisma/schema.prisma` — income model definition.
- `src/app/(income)/` — server/client income screens.
- `src/types/income.ts` — shared income types.
- `src/utils/validation.ts` — income validation schemas.