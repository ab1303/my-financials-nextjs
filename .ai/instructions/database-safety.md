# Database Migration & Prisma Safety

> **CRITICAL: Follow these rules strictly to prevent data loss.**

## Pre-Operation Checklist
- **Stop Dev Server**: Always stop the dev server before `prisma generate`, `prisma migrate dev`, or `prisma db push` to avoid Windows EPERM locking errors.
- **Check for Node processes**: Run `tasklist | grep -i node` if unsure.

## Safety Rules
- **No `prisma migrate reset`**: NEVER run this without explicit user consent and backup confirmation.
- **Destructive Warnings**: Always provide a "⚠️ WARNING: This will DELETE ALL DATA" and ask for confirmation before any destructive command.
- **Backup**: Recommend `pg_dump` before major schema changes.
- **Guard Rail Enforcement**: The Prisma CLI wrapper (`scripts/prisma-safe.sh`) blocks destructive operations. See `.ai/instructions/prisma-guard-rail.md` for details.

## ⛔ NEVER Use `prisma db push` for Schema Changes

> **This rule exists because of a real incident**: `db push` was used to apply schema changes without creating migration files. The result was 46 migrations worth of drift, requiring a full migration squash to recover. All data survived but several hours of engineering time were lost.

**`prisma db push` is PROHIBITED for schema changes.** It silently updates the database without creating a migration file, causing irreversible drift between the DB state and migration history.

| Command | Allowed? | Why |
|---------|----------|-----|
| `pnpm prisma migrate dev --name xyz` | ✅ Always | Creates a timestamped `.sql` file in `prisma/migrations/` |
| `pnpm prisma db push` | ❌ Never | Modifies DB without recording the change — causes drift |
| Direct SQL via MCP/Studio | ❌ Never | Same problem — unrecorded schema change |

**The only correct schema change workflow:**
```
1. Edit prisma/schema.prisma
2. pnpm prisma migrate dev --name <descriptive-name>
3. Commit: schema.prisma + prisma/migrations/<name>/migration.sql together
```

**If you encounter "We need to reset the schema" / drift warnings:**
- Do NOT run `migrate reset` — all data will be lost
- STOP and explain the situation to the user
- Follow the drift-resolution procedure in the "Drift Recovery" section below

## Drift Recovery (Without Data Loss)

If `migrate dev` reports schema drift:
1. Use `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` to see what the DB is missing
2. Create a catch-up migration manually recording already-applied changes
3. Mark it applied with `prisma migrate resolve --applied <name>` (do NOT re-run it)
4. Then run `migrate dev` normally for new changes

If the migration history is severely out of sync (many `db push`es without migrations):
1. Generate a full baseline: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
2. Archive old migrations to `prisma/migrations_archive/`
3. Create `00000000000000_baseline_init/migration.sql` with the generated SQL
4. Mark as applied: `prisma migrate resolve --applied 00000000000000_baseline_init`
5. Re-run `migrate dev` for any pending schema changes

## Migration Patterns
- Add columns with default values when adding required fields.
- Use separate migrations for schema changes and data migrations.
- Restart dev server with `pnpm run dev` after operations complete.

## Programmatic Guard Rails

All `pnpm prisma` commands are intercepted by `scripts/prisma-safe.sh`:

- ✅ **Safe commands** (generate, status, studio) — pass through automatically
- ❌ **Destructive commands** (migrate reset, db push) — **BLOCKED** unless `PRISMA_FORCE_APPROVED=true` is set

This prevents data loss even in yolo mode or with background agents. See `.ai/instructions/prisma-guard-rail.md` for approval workflow.
