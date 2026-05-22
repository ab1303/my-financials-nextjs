# Prisma CLI Guard Rail

## Purpose

Prevent accidental data loss from destructive Prisma operations, even when running in yolo mode or with background agents.

## How It Works

All `pnpm prisma` commands are routed through `scripts/prisma-safe.sh`, which:

1. **Blocks destructive operations:**
   - `prisma migrate reset` — Resets entire database
   - `prisma db push` — Modifies database schema

2. **Requires explicit approval:**
   ```bash
   PRISMA_FORCE_APPROVED=true pnpm prisma migrate reset
   ```

3. **Allows safe operations to pass through:**
   - `prisma generate` — Generate Prisma client
   - `prisma migrate status` — Check migration status
   - `prisma studio` — Open Prisma Studio
   - etc.

## Why This Matters

- With yolo mode enabled, agents can execute background commands without user prompts
- Instructions alone cannot prevent an agent from deciding a destructive operation is necessary
- This programmatic guard rail enforces the safety rule at execution time

## For Agents

### Running Safe Prisma Commands

Safe commands bypass the guard rail automatically:

```bash
pnpm prisma generate        # ✅ Works without approval
pnpm prisma migrate status  # ✅ Works without approval
```

### Running Destructive Commands

If you encounter schema drift or other issues requiring `migrate reset` or `db push`:

1. **STOP immediately** — Do not run the command
2. **Explain the situation** to the user
3. **Ask for explicit approval** before proceeding
4. **Show the exact command** that will be run
5. Only proceed if user provides: `PRISMA_FORCE_APPROVED=true pnpm prisma <command>`

### Blocked Commands

```bash
pnpm prisma migrate reset   # ❌ BLOCKED - requires approval
pnpm prisma db push         # ❌ BLOCKED - requires approval
```

Attempting to run without `PRISMA_FORCE_APPROVED=true` will fail with a clear error message.

## For Users

### Approving a Destructive Operation

If an agent or tool needs your approval to run a destructive command:

```bash
# Example: Resetting the database (⚠️ DELETES ALL DATA)
PRISMA_FORCE_APPROVED=true pnpm prisma migrate reset
```

### Safe During Development

- This guard rail only blocks `migrate reset` and `db push`
- Normal migrations via `prisma migrate dev` are safe and recommended
- Safe migrations create timestamped migration files for version control

### Recovery If Data Is Lost

See `.ai/instructions/database-safety.md` for recovery procedures.
