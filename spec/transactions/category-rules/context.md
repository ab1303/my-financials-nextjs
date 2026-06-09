# Category Rules — Domain Context

## Problem
Users need to automate recurring transaction categorization to avoid repeating manual fixes.

## Architecture
- **Persistence**: `CategoryRule` model.
- **Service Layer**: `src/server/services/transactions/category-rule.service.ts` handles rule logic and application.
- **API**: `categoryRule` tRPC router (`src/server/trpc/router/category-rule.ts`).

## Scope
- `CategoryRule` model for pattern-based categorization.
- Inline UI for rule creation during transaction editing.
- Rule management page at `/cashflow/category-rules/`.
- Automated rule application on import (post-confirm).
- Performant pattern matching using `pg_trgm` GIN index.
