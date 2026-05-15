---
name: implement-from-spec
description: >
  Read spec/{feature}/context.md and lld.md, parse the phase map, resolve
  phase dependencies, and spawn the appropriate implementation subagent for
  each independent phase. Use when the user says "implement this", "build from
  spec", "implement the spec", "start implementation", or "get to work on
  {feature}". Triggers on: "implement from spec", "build the feature", "start
  coding", "implement phases", "delegate implementation".
metadata:
  author: local
  version: "1.1.0"
  argument-hint: <feature-name> [--phase N]
---

# Implement From Spec

Read `spec/{feature}/context.md` and `spec/{feature}/lld.md`, analyse phase
dependencies, then spawn the correct implementation subagent for each phase —
running independent phases in parallel and sequential phases in order.

---

## Step 1 — Resolve the Feature and Spec Files

**Feature name** — from argument (e.g. `implement-from-spec reimbursements`),
or ask with `ask_user` if not provided.

**Optional `--phase N`** — if provided, only implement that specific phase;
skip the dependency analysis.

Read both files in parallel:
```
spec/{feature}/context.md
spec/{feature}/lld.md
```

If either file is missing, stop and tell the user to run the `spec-from-context`
skill first.

---

## Step 2 — Detect the Implementation Agent

Inspect `package.json` and the project structure to select the right agent:

| Signal | Agent to use |
|---|---|
| `next`, `react`, `@trpc/server` in `package.json` | `Next.js Expert` |
| `*.csproj` or `*.sln` present | `C# Expert` or `.NET Implementation Engineer` |
| `go.mod` present | `general-purpose` (Go) |
| `requirements.txt` / `pyproject.toml` | `general-purpose` (Python) |

For this repo the agent is always **`Next.js Expert`**.

State the chosen agent to the user before proceeding.

---

## Step 3 — Parse the Phase Map

From `lld.md`, extract:
1. The **Phase Map** block (usually a fenced code block near the top)
2. Each **Phase section** (heading + body)
3. Any **explicit dependency statements** in the LLD
   (e.g. "Phase 2 is a prerequisite for Phase 3", "can be developed in parallel")

Build a dependency graph:
```
phase_1 → phase_2 → phase_3
                  ↘ phase_4 (parallel with 3)
```

Identify **waves** — groups of phases that can run simultaneously:
- Wave 1: phases with no unmet dependencies
- Wave 2: phases whose only dependencies are in Wave 1
- etc.

**Typical Next.js / T3 dependency order** (use as default if not explicit):
```
Schema migration  (Phase 1)          ← always first, no deps
Constants/types   (Phase 2)          ← depends on schema
Service layer     (Phase 3)          ← depends on schema + types
tRPC router       (Phase 4)          ← depends on service
UI components     (Phase 5)          ← depends on router (for E2E) but can start in parallel
Tests             (alongside each)   ← TDD: write tests with the phase they cover
```

Persist the phase plan to the SQL session database:
```sql
INSERT INTO todos (id, title, description, status) VALUES
  ('phase-1', 'Phase 1 — {name}', '{files}, {what it does}', 'pending'),
  ('phase-2', 'Phase 2 — {name}', '{files}, {what it does}', 'pending'),
  ...;

INSERT INTO todo_deps (todo_id, depends_on) VALUES
  ('phase-2', 'phase-1'),
  ('phase-3', 'phase-2'),
  ('phase-4', 'phase-3');
```

---

## Step 4 — Build the Context Bundle for Each Phase

Each subagent prompt MUST be self-contained. Do NOT tell the subagent to "read
the source files" — provide the content directly.

For every phase, assemble:

### a) Full `context.md` content (verbatim)

### b) The specific LLD phase section (verbatim)
Extract only the relevant `## Phase N` section, not the entire LLD.

### c) Current file contents for files the phase will touch
Read each file listed in the phase's "Files to modify/create" table.
Paste the full content inline in the prompt. If a file exceeds 300 lines,
include only the relevant section (the function/component to modify) with a
comment `// ... rest of file unchanged` at the truncation point.

### d) Project-wide constraints (always include)
```
STACK CONSTRAINTS — must follow exactly:
- Next.js 16 App Router (T3 Stack): tRPC, Prisma, NextAuth v5 beta
- tRPC routers: src/server/trpc/router/ — NOT src/server/api/
- Prisma context: ctx.prisma — NOT ctx.db
- tRPC client: import { trpc } from '@/server/trpc/client'
- Toast: import { toast } from 'sonner' — NOT react-toastify
- Package manager: pnpm ONLY — never npm or yarn
- Run pnpm run build before marking phase complete
- Stop dev server before any prisma migrate or prisma generate (Windows EPERM)
- Tests: Vitest + @testing-library/react in src/__tests__/unit/
- Prisma mock: vitest-mock-extended at src/__tests__/mocks/prisma.mock.ts
- TDD: write tests first, then implementation
- All context needed is provided in this prompt. Do NOT explore the codebase
  for additional files unless a compile error forces it.
```

### e) TDD test cases from the LLD
Extract the test case table for this phase from lld.md. Include it with
the instruction: "Write these tests first; all must pass before the phase is complete."

### f) Success criteria
"Phase is complete when:
1. All listed test cases pass
2. `pnpm run build` succeeds with no errors
3. The following files have been modified/created: {list}"

---

## Step 5 — Execute the Waves

### Wave 1 (independent phases — run in parallel)

For each phase in Wave 1, call `task` tool simultaneously:
```
agent_type: "Next.js Expert"   (or detected agent)
mode: "background"
name: "{feature}-phase-{N}"
description: "Implementing Phase N — {name}"
prompt: {assembled context bundle from Step 4}
```

Wait for all Wave 1 agents to complete before starting Wave 2.

### Wave 2+ (dependent phases — run after Wave 1 complete)

Before starting each Wave 2+ phase:
1. Update todo status: `UPDATE todos SET status = 'in_progress' WHERE id = 'phase-N'`
2. Re-read any files that were modified by the previous wave's agents
   (the agent may have changed them — your cached copy is stale)
3. Include the **updated file contents** in the next agent's context bundle
4. Launch the next wave

### Single-phase override (`--phase N`)

If `--phase N` was specified, skip wave analysis. Build context for just
that phase and launch one subagent synchronously (`mode: "sync"` if expected
to complete quickly, else `"background"`).

---

## Step 6 — Handle Agent Results

For each completed agent:

1. **On success:** Mark todo done, report files changed
   ```sql
   UPDATE todos SET status = 'done' WHERE id = 'phase-N';
   ```

2. **On failure:** Mark todo blocked, surface the error to the user
   ```sql
   UPDATE todos SET status = 'blocked', description = 'Error: {message}' WHERE id = 'phase-N';
   ```
   Do NOT automatically retry — ask the user how to proceed.

3. **Build verification:** After the final wave, run:
   ```powershell
   pnpm run build 2>&1
   ```
   If the build fails, surface the errors clearly. Do NOT mark the feature
   complete until the build passes.

---

## Step 7 — Final Report

Output a summary table:

```
## Implementation Complete — {Feature}

| Phase | Status | Files Changed |
|---|---|---|
| Phase 1 — Schema migration | ✅ Done | prisma/schema.prisma |
| Phase 2 — Constants        | ✅ Done | src/server/services/transactions/constants.ts |
| Phase 3 — Service          | ✅ Done | ledger.service.ts |
| Phase 4 — Router           | ✅ Done | transaction-ledger.ts |
| Phase 5 — UI               | ✅ Done | TransactionRow.tsx, TransactionLedgerTable.tsx |

Build: ✅ Passed
Tests: ✅ All passing

Next steps:
- Run `pnpm run dev` to verify in browser
- See spec/{feature}/hld.md §"Out of Scope" for Phase 2 items
```

---

## Important Constraints

### Do NOT run in parallel:
- Any phase that modifies Prisma schema (`prisma/schema.prisma`)
  — only one prisma migration can run at a time
- Any phase that requires `prisma migrate dev` or `prisma generate`
  — stop dev server first, run migration, restart dev server

### Do NOT skip:
- Reading updated file contents between waves
  (stale content causes agents to overwrite each other's work)
- The `pnpm run build` final verification

### Do NOT mark complete if:
- Build has TypeScript errors
- Tests are failing
- An agent reported partial success

---

## Invocation Examples

```
# Full implementation — all phases
implement-from-spec reimbursements

# Single phase only
implement-from-spec reimbursements --phase 3

# Implicit (user says "build the feature" after spec discussion)
# → infer feature name from session context, confirm with user
```
