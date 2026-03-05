# Database Migration & Prisma Safety

> **CRITICAL: Follow these rules strictly to prevent data loss.**

## Pre-Operation Checklist
- **Stop Dev Server**: Always stop the dev server before `prisma generate`, `prisma migrate dev`, or `prisma db push` to avoid Windows EPERM locking errors.
- **Check for Node processes**: Run `tasklist | grep -i node` if unsure.

## Safety Rules
- **No `prisma migrate reset`**: NEVER run this without explicit user consent and backup confirmation.
- **Destructive Warnings**: Always provide a "⚠️ WARNING: This will DELETE ALL DATA" and ask for confirmation before any destructive command.
- **Backup**: Recommend `pg_dump` before major schema changes.

## Migration Patterns
- Add columns with default values when adding required fields.
- Use separate migrations for schema changes and data migrations.
- Restart dev server with `pnpm run dev` after operations complete.
