# Skill: Prisma Migration — FK Constraint Fix

## When to Use

Use this skill when a Prisma migration fails with a **foreign key constraint violation** caused by:
- Renaming a model (Prisma generates DROP + CREATE, not RENAME)
- Changing a FK target table (`StockHolding.accountId Business → FinancialAccount`)
- Existing rows referencing the old table that aren't yet in the new table

**Trigger phrases**: "FK constraint error", "migration failed", "foreign key violation", "data will be lost", "prisma migrate reset"

---

## Root Cause

When you rename a Prisma model (e.g. `BankAccount → FinancialAccount`), Prisma **generates DROP + CREATE**, not `ALTER TABLE RENAME`. The generated migration SQL:

1. Drops all FKs pointing to the old table
2. Drops the old table (**data gone!**)
3. Creates the new table (**empty**)
4. Re-adds FK constraints → **FAILS** because existing rows in related tables reference IDs that no longer exist

PostgreSQL wraps DDL in a transaction, so the whole migration **rolls back** on failure — the old table survives, but the migration is marked as failed in `_prisma_migrations`.

---

## Fix Strategy (No Data Loss)

### Step 1 — Diagnose

Use a sub-agent (model: `gpt-4.1` — faster/cheaper for this kind of diagnostic work) with access to:
- **Prisma MCP** or **Postgres MCP** (`postgresql://postgres:postgres@host.docker.internal:5432/financials`)
- Working directory of the project

Have the agent check:
```sql
-- Does the new table exist?
SELECT table_name FROM information_schema.tables WHERE table_name = 'FinancialAccount';
-- What state is the migration in?
SELECT id, migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;
-- Do any rows in related tables have dangling IDs?
SELECT COUNT(*) FROM "StockHolding";
```

### Step 2 — Edit the Migration SQL

Find the failed migration file at:
```
prisma/migrations/<timestamp>_<name>/migration.sql
```

Insert **data migration SQL between table creation and FK addition**:

```sql
-- CreateTable "NewTable" ...
-- CreateIndex ...

-- DataMigration: Copy old table rows → new table (preserving IDs)
INSERT INTO "NewTable" (id, col1, "renamedCol", "userId", "createdAt", "updatedAt")
SELECT id, col1, "oldColName", "userId", "createdAt", "updatedAt"
FROM "OldTable";

-- DataMigration: For FK-retarget cases (e.g. StockHolding.accountId Business → FinancialAccount)
-- Create a "Default Account" FinancialAccount for each BROKERAGE with existing holdings
INSERT INTO "FinancialAccount" (id, name, "institutionId", "userId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Default Account', b.id, b."userId", NOW(), NOW()
FROM "Business" b
WHERE b.type = 'BROKERAGE'
  AND EXISTS (SELECT 1 FROM "StockHolding" sh WHERE sh."accountId" = b.id)
ON CONFLICT DO NOTHING;

-- Retarget FK column
UPDATE "StockHolding" sh
SET "accountId" = fa.id
FROM "FinancialAccount" fa
JOIN "Business" b ON fa."institutionId" = b.id
WHERE sh."accountId" = b.id
  AND fa.name = 'Default Account';

-- DropTable (now safe — data is in new table, FKs retargeted)
DROP TABLE "OldTable";

-- AddForeignKey ...
```

> **Key rule**: move `DROP TABLE "OldTable"` to **after** the data migration INSERTs, not before.

### Step 3 — Apply Without Checksum Check

If Prisma refuses to re-run because it detects the migration file was "modified after applied":

```bash
# Apply the fixed SQL directly to the DB (bypasses Prisma checksum validation)
pnpm prisma db execute \
  --file "prisma/migrations/<timestamp>_<name>/migration.sql" \
  --schema prisma/schema.prisma

# Tell Prisma the migration is now applied
pnpm prisma migrate resolve --applied <timestamp>_<name>

# Regenerate Prisma client
pnpm prisma generate
```

If Prisma says the migration failed (not modified), first mark it rolled back, then re-apply:
```bash
pnpm prisma migrate resolve --rolled-back <timestamp>_<name>
pnpm prisma migrate dev
```

> If `migrate dev` then complains about a modified file, fall back to `db execute` + `resolve --applied`.

---

## Diagnostic Sub-Agent Template

When spawning an agent to investigate:

```
agent_type: "general-purpose"
model: "gpt-4.1"   ← faster and cheaper; sufficient for diagnostic + SQL tasks
mode: "background"
```

Provide:
- DB connection string
- Path to the failed migration SQL file
- The schema rename being performed
- Instruction to check `_prisma_migrations` and related tables before acting

---

## Safety Rules

- **NEVER run `prisma migrate reset`** unless the user explicitly confirms they have a backup and want to destroy all data
- Always check if the old table still exists before assuming data is lost (PostgreSQL rolls back failed DDL transactions)
- Preserve original `id` values when copying rows — all other FK-referencing tables depend on them
- Use `ON CONFLICT DO NOTHING` on INSERT to handle idempotent re-runs

---

## Related Instructions

- `.ai/instructions/database-safety.md` — General Prisma safety rules
- Stop dev server before any `prisma migrate` or `prisma generate` on Windows (prevents EPERM errors)
