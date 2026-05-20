# AGENTS.md

Rules for all AI agents working in this repository.

---

## Efficiency

- Read files yourself before delegating — only launch sub-agents for work you haven't done.
- Pass file content directly in sub-agent prompts; don't tell them to read the codebase.
- Batch all independent file reads into one parallel tool-call turn.

## Planning

- Spec and PRD files → `spec/{domain}/{feature}/` only (see Spec Documents below).
- `plan.md` → session workspace only; never commit planning files to the repo.
- Track todo status in the SQL session database throughout implementation.

### Spec Migration When Touching a Feature

**When you work on a feature, migrate its spec FIRST:**

If the feature spec is in the old location (`spec/{feature}/`), migrate it to the new structure (`spec/{domain}/{feature}/`) before starting implementation. This is not optional — it ensures:
- Consistent spec organization across all features
- No "ghost" specs in old locations
- Clean git history (migration is a separate commit from implementation)

**Spec consolidation is part of migration:**

When migrating, consolidate all content (hld.md, lld.md, context.md, any implementation summaries) into the new 2-level structure:
- Extract shared schema/patterns → domain `hld.md` (write once if new domain)
- Problem + scope → feature `context.md` (no file inventory)
- Implementation detail + file inventory → feature `lld.md`

**Migration workflow:**
1. Agent checks: does `spec/{domain}/{feature}/` exist? (new location)
2. If NO: check `spec/{feature}/` (old location exists)
3. If old location found: delegate spec migration to gpt-4.1 background agent
4. Wait for migration to complete
5. Validate structure (file counts, no duplication)
6. Commit migration as separate "refactor: migrate {feature} spec" commit
7. Proceed with implementation

**Reference:** `.ai/instructions/migration-agent-template.md` has the migration template; `.ai/instructions/spec-migration-map.md` lists all 48 features with target domains. See `.ai/instructions/spec-consolidation.md` for the full workflow.

## Spec Documents

The spec tree uses **2 levels by default**, promoting to **3 levels only when a feature has 3 or more independently-implementable phases**.

### Tree Shapes

**2-level (default)** — one feature, one implementation scope:
```
spec/
  {domain}/
    hld.md                  ← domain architecture, shared schema, decisions
    {feature}/
      context.md            ← what the feature does and what domain concepts it relies on
      lld.md                ← implementation detail: interfaces, API contracts, DB patterns
```

**3-level (promoted)** — feature has 3+ phases that can be delegated to independent agents:
```
spec/
  {domain}/
    hld.md
    {feature}/
      context.md            ← feature scope and domain dependencies (no file inventory)
      {sub-feature}/
        lld.md              ← atomic vertical slice for this phase only
      {sub-feature}/
        lld.md
```

**Standalone (no domain grouping)** — truly independent, single-phase feature:
```
spec/
  standalone/
    {feature}/
      hld.md                ← feature-level architecture and decisions
      context.md            ← problem statement, scope boundary
      lld.md                ← implementation detail: interfaces, API contracts, DB patterns
```

### Document Responsibilities

| File | Scope | Contains | Never contains |
|---|---|---|---|
| `hld.md` | Domain | Shared schema, architecture decisions, patterns common to all features in this domain | File lists, implementation steps |
| `context.md` | Feature | Problem statement, domain dependencies (links to `hld.md` sections), scope boundary (in/out) | File inventory, schema copy-paste from HLD |
| `lld.md` | Feature (2-level) or Sub-feature (3-level) | Interfaces, Zod schemas, API contracts, DB patterns, acceptance criteria — scoped to this slice only | Anything outside this slice's scope |

### When to Promote from 2-level to 3-level

> Promote if and only if: **the feature has 3 or more phases that can be assigned to independent agents without blocking each other.**

If in doubt, stay at 2-level. A well-sectioned `lld.md` with clear H2 headings is functionally equivalent to multiple sub-feature LLDs.

### Sub-feature Naming Convention

Sub-feature folder names must use **verb-noun** format: `match-transfers/`, `review-ui/`, `parse-csv/`.  
Never use layer names: ~~`schema/`~~, ~~`api/`~~, ~~`ui/`~~ — these recreate horizontal layering.

### Context Bundle by Task

| Task | Pass |
|---|---|
| Domain architecture review | `{domain}/hld.md` |
| Feature planning / orientation | `{domain}/hld.md` + `{feature}/context.md` |
| Implement a 2-level feature | `{feature}/context.md` + `{feature}/lld.md` |
| Implement one sub-feature (3-level) | `{feature}/context.md` + `{sub-feature}/lld.md` |
| Debug | Relevant `lld.md` + affected files |
| New session on active feature | `{domain}/hld.md` + `{feature}/context.md`, then scoped `lld.md` on request |

Never pass all three docs at once for a single implementation task — context.md alone is enough orientation; lld.md is the implementation contract.

## Code

- Use `pnpm` exclusively — never `npm` or `yarn`.
- Run `pnpm run build` before marking any feature complete.
- Stop the dev server before any Prisma CLI operation (prevents EPERM on Windows).
- Never run `prisma migrate reset` without explicit user consent and a confirmed backup.

## Subagent Scope Control (Critical Lesson)

**Problem**: Subagents will globally format, lint, and rewrite unrelated files unless explicitly constrained. This causes 300+ file modifications that pollute git history.

**Solution**: Every subagent prompt must include hard scope boundaries:

```
⚠️ CRITICAL CONSTRAINTS (NON-NEGOTIABLE):
- You may ONLY modify these exact files: [explicit list]
- DO NOT run: pnpm lint --fix, pnpm format, prettier --write, or global formatting
- DO NOT run: pnpm run build (orchestrator handles verification)
- DO NOT commit code (orchestrator commits when complete)
- DO NOT modify test files except those explicitly listed
- DO NOT run vitest --update or snapshot auto-update
- DO NOT touch any files outside the scope above
```

**Why**: Without these constraints, agents interpret "implement Phase 1" as "optimize entire codebase". ESLint auto-fix, Prettier rewrites, and vitest snapshots reformat hundreds of unrelated files.

**Result**: Always lead subagent prompts with hard file scope. If an agent reports warnings in unscoped files, instruct it to ignore them.

## Dev Server Safety (CRITICAL)

**NEVER auto-kill Node processes after running `pnpm run build`.** This terminates the CLI session and abandons the user.

- ⛔ **FORBIDDEN**: `Stop-Process` on Node, killing Node processes, or any command that terminates Node
- ✅ **REQUIRED**: After `pnpm run build`, ask the user to manually stop the dev server (Ctrl+C) and restart with `pnpm run dev`
- ✅ **REQUIRED**: Tell the user the dev server is locked and needs manual restart (do not attempt auto-restart)
- ✅ **REQUIRED**: When port conflicts occur, inform the user and request manual intervention

**Pattern to avoid:**
```
# ❌ WRONG - This kills the CLI:
Stop-Process -Name node
pnpm run dev
```

**Correct pattern:**
```
# ✅ RIGHT - User restarts manually:
"Please stop the dev server with Ctrl+C, then run: pnpm run dev"
```

## Shared Components

- Components used by more than one feature belong in `src/components/`, not inside any feature's `_components/` folder.
- Before deleting a feature directory, grep `src/` for all imports of its files. Extract anything imported outside the feature to `src/components/` first.
- A file at `feature-a/_components/foo.tsx` is owned by `feature-a`. Cross-feature imports are hidden dependencies — they break silently on cleanup.

## UI Rules (Recurring Issues)

### Dark Mode
- Always add `dark:` variants for every color utility. See `.ai/instructions/dark-mode-and-react-select.md`.

### react-select dark mode
- Always use `unstyled` + `classNames` **const** (not a function). See `.ai/instructions/dark-mode-and-react-select.md`.

### Cursor on labels and table headers
- Use the shared `THeadTH` component — it includes `select-none cursor-default`. See `.ai/instructions/cursor-and-text-selection.md`.

### Nested forms
- Never nest `<form>` inside `<form>`. Use `createPortal` for overlays/drawers. See `.ai/instructions/form-patterns.md`.

## Canonical Instructions

All coding standards live in `.ai/instructions/`. Read the relevant file before implementing:

| Topic | File |
|---|---|
| Auth / session | `.ai/instructions/auth.md` |
| Database / Prisma safety | `.ai/instructions/database-safety.md` |
| Forms (react-hook-form, zod) | `.ai/instructions/form-patterns.md` |
| Middleware & icons | `.ai/instructions/middleware-and-icons.md` |
| State management & notifications | `.ai/instructions/state-and-ui.md` |
| Dark mode & react-select | `.ai/instructions/dark-mode-and-react-select.md` |
| Cursor & text selection | `.ai/instructions/cursor-and-text-selection.md` |
| Performance | `.ai/instructions/performance.md` |
| Deployment | `.ai/instructions/deployment.md` |
| Product / UX principles | `.ai/instructions/product-owner-ux.md` |
| Testing & subagent orchestration | `.ai/instructions/testing-and-subagents.md` |
| Git worktree workflow | `.ai/instructions/git-worktree.md` |

`.github/instructions/` contains GitHub Copilot **scoped** rules (file-pattern bound, `applyTo` frontmatter). Do not duplicate general rules there — add them to `.ai/instructions/` instead.

### Spec Workflow Documentation

Spec-related workflow and migration guides live in `.ai/instructions/` (accessible to all Copilot CLI agents):

| Document | Purpose | When to Read |
|---|---|---|
| `.ai/instructions/spec-structure.md` | Why the new 2-level/3-level paradigm | Understanding the decision |
| `.ai/instructions/spec-consolidation.md` | When/how to migrate a feature spec | Before starting work on a feature with old spec |
| `.ai/instructions/spec-implementation.md` | Complete guide with scenarios | Comprehensive reference (read if unsure) |
| `.ai/instructions/spec-migration-map.md` | All 48 features with target domains | Finding what domain a feature belongs to |
| `.ai/instructions/migration-agent-template.md` | Agent template for spec migrations | Delegating a spec migration to gpt-4.1 |


