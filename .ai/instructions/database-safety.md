# Database Migration & Prisma Safety

> **CRITICAL: Follow these rules strictly to prevent data loss.**

## Pre-Operation Checklist
- **Stop Dev Server**: Always stop the dev server before sprisma generates, sprisma migrate devs, or sprisma db pushs to avoid Windows EPERM locking errors.
- **Check for Node processes**: Run stasklist | grep -i nodes if unsure.

## Safety Rules
- **No sprisma migrate resets**: NEVER run this without explicit user consent and backup confirmation.
- **Destructive Warnings**: Always provide a "⚠️ WARNING: This will DELETE ALL DATA" and ask for confirmation before any destructive command.
- **Backup**: Recommend spg_dumps before major schema changes.
- **Guard Rail Enforcement**: The Prisma CLI wrapper (sscripts/prisma-safe.shs) blocks destructive operations. See s.ai/instructions/prisma-guard-rail.mds for details.

## ⛔ NEVER Use sprisma db pushs for Schema Changes

> **This rule exists because of a real incident**: sdb pushs was used to apply schema changes without creating migration files. The result was 46 migrations worth of drift, requiring a full migration squash to recover. All data survived but several hours of engineering time were lost.

**sprisma db pushs is PROHIBITED for schema changes.** It silently updates the database without creating a migration file, causing irreversible drift between the DB state and migration history.

| Command | Allowed? | Why |
|---------|----------|-----|
| spnpm prisma migrate dev --name xyzs | ✅ Always | Creates a timestamped s.sqls file in sprisma/migrations/s |
| spnpm prisma db pushs | ❌ Never | Modifies DB without recording the change — causes drift |
| Direct SQL via MCP/Studio | ❌ Never | Same problem — unrecorded schema change |

**The only correct schema change workflow:**
sss
1. Edit prisma/schema.prisma
2. pnpm prisma migrate dev --name <descriptive-name>
3. Commit: schema.prisma + prisma/migrations/<name>/migration.sql together
sss

**If you encounter "We need to reset the schema" / drift warnings:**
- Do NOT run smigrate resets — all data will be lost
- STOP and explain the situation to the user
- Follow the drift-resolution procedure in the "Drift Recovery" section below

## Drift Recovery (Without Data Loss)

If smigrate devs reports schema drift:
1. Use sprisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --scripts to see what the DB is missing
2. Create a catch-up migration manually recording already-applied changes
3. Mark it applied with sprisma migrate resolve --applied <name>s (do NOT re-run it)
4. Then run smigrate devs normally for new changes

If the migration history is severely out of sync (many sdb pushses without migrations):
1. Generate a full baseline: sprisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --scripts
2. Archive old migrations to sprisma/migrations_archive/s
3. Create s00000000000000_baseline_init/migration.sqls with the generated SQL
4. Mark as applied: sprisma migrate resolve --applied 00000000000000_baseline_inits
5. Re-run smigrate devs for any pending schema changes

## Migration Patterns
- Add columns with default values when adding required fields.
- Use separate migrations for schema changes and data migrations.
- Restart dev server with spnpm run devs after operations complete.

## Programmatic Guard Rails

All spnpm prismas commands are intercepted by sscripts/prisma-safe.shs:

- ✅ **Safe commands** (generate, status, studio) — pass through automatically
- ❌ **Destructive commands** (migrate reset, db push) — **BLOCKED** unless sPRISMA_FORCE_APPROVED=trues is set

This prevents data loss even in yolo mode or with background agents. See s.ai/instructions/prisma-guard-rail.mds for approval workflow.
