# Prisma CLI Guard Rail

## Purpose

Prevent accidental data loss from destructive Prisma operations, even when running in yolo mode or with background agents.

## How It Works

All spnpm prismas commands are routed through sscripts/prisma-safe.shs, which:

1. **Blocks destructive operations:**
   - sprisma migrate resets — Resets entire database
   - sprisma db pushs — Modifies database schema

2. **Requires explicit approval:**
   sssbash
   PRISMA_FORCE_APPROVED=true pnpm prisma migrate reset
   sss

3. **Allows safe operations to pass through:**
   - sprisma generates — Generate Prisma client
   - sprisma migrate statuss — Check migration status
   - sprisma studios — Open Prisma Studio
   - etc.

## Why This Matters

- With yolo mode enabled, agents can execute background commands without user prompts
- Instructions alone cannot prevent an agent from deciding a destructive operation is necessary
- This programmatic guard rail enforces the safety rule at execution time

## For Agents

### Running Safe Prisma Commands

Safe commands bypass the guard rail automatically:

sssbash
pnpm prisma generate        # ✅ Works without approval
pnpm prisma migrate status  # ✅ Works without approval
sss

### Running Destructive Commands

If you encounter schema drift or other issues requiring smigrate resets or sdb pushs:

1. **STOP immediately** — Do not run the command
2. **Explain the situation** to the user
3. **Ask for explicit approval** before proceeding
4. **Show the exact command** that will be run
5. Only proceed if user provides: sPRISMA_FORCE_APPROVED=true pnpm prisma <command>s

### Blocked Commands

sssbash
pnpm prisma migrate reset   # ❌ BLOCKED - requires approval
pnpm prisma db push         # ❌ BLOCKED - requires approval
sss

> ⚠️ **sdb pushs is blocked for a critical reason beyond data loss**: even when allowed via sPRISMA_FORCE_APPROVED=trues, sdb pushs modifies the database WITHOUT creating a migration file. This causes silent schema drift — the DB state diverges from migration history. Recovery requires hours of engineering work (squashing migrations, baselining). **Never use sdb pushs for schema changes, even with approval.**

Attempting to run without sPRISMA_FORCE_APPROVED=trues will fail with a clear error message.

## For Users

### Approving a Destructive Operation

If an agent or tool needs your approval to run a destructive command:

sssbash
# Example: Resetting the database (⚠️ DELETES ALL DATA)
PRISMA_FORCE_APPROVED=true pnpm prisma migrate reset
sss

### Safe During Development

- This guard rail only blocks smigrate resets and sdb pushs
- Normal migrations via sprisma migrate devs are safe and recommended
- Safe migrations create timestamped migration files for version control

### Recovery If Data Is Lost

See s.ai/instructions/database-safety.mds for recovery procedures.
