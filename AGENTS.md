# AGENTS.md

Universal rules for all AI agents. Agent tweaks → `CLAUDE.md` / `GEMINI.md`. Detail → `.ai/instructions/`.
Universal rules here **only** — never duplicate in agent-specific files. Governance: `.ai/instructions/instruction-governance.md`.

---

## Operation Risk Tiers

Every action falls into one tier. When in doubt, use the higher tier.

| Tier                          | Risk   | Examples                                                                    | Gate                                          |
| ----------------------------- | ------ | --------------------------------------------------------------------------- | --------------------------------------------- |
| **Tier 1 — Always OK**        | Low    | Read files, `type-check`, `lint`, `git log`, search codebase                | None — proceed immediately                    |
| **Tier 2 — Ask First**        | Medium | Edit source files, create/modify specs, run migrations, create branches     | Human review of plan before starting          |
| **Tier 3 — Never Autonomous** | High   | `git push`, `git reset --hard`, `prisma migrate reset`, deploy, delete data | Explicit confirmation + verification evidence |

See `.ai/instructions/compaction.md` for the compaction protocol that applies after Tier 2 operations.

## Project Context

- **Framework**: Next.js App Router (T3 Stack) — tRPC, Prisma, NextAuth v5 beta, Tailwind, Flowbite.
- **Directory**: Source → `src/`. Schema → `prisma/`. Specs → `spec/`. Harness state → `.harness/`.
- **CI/CD**: GitHub Actions → Render.com. **Testing**: Playwright `e2e/`, Vitest `src/__tests__/`.

## Hard Constraints

- **No auto-commit/push**: Require explicit user confirmation before any `git commit` or `git push`. Do not auto-commit.
- **New features**: Follow `prd-mode` workflow before implementation — never jump straight to code.
- **DB scope**: `my-financials-nextjs` only — never list or query other DBs (e.g. `CapacityDb`).
- **Dev server**: NEVER auto-kill Node. After `pnpm run build`, tell user Ctrl+C + restart manually. _Excuse to reject: "I'll just restart it" → wrong, always ask._ See `.ai/instructions/dev-server-safety.md`.
- **Schema**: NEVER `prisma db push`. Always `prisma migrate dev --name <name>`. _Excuse to reject: "db push is faster" → wrong, it causes irreversible drift._ See `.ai/instructions/database-safety.md`.

## Environment (Windows 11)

- Use `bash`. Never `echo` / `Out-File` / `mkdir` — use workspace file tools exclusively.
- Paths use `\` backslashes. Pass `--quiet` / `--silent` to `pnpm` and `prisma`.

## Session Lifecycle

Specs → `spec/{domain}/{feature}/`. `plan.md` → session only, never commit.

### Session Start — before any implementation work

1. Read `.harness/progress.md` — most recent entry says where the last session stopped.
2. Run `git log --oneline -5` — confirm branch and recent commits.
3. Check `.harness/feature-status.json` — which feature is `in-progress`.
4. Announce: "Last session worked on X. Continuing from Y."

### Session End — before stopping

1. Write a new entry to `.harness/progress.md` (format: see `.harness/README.md`).
2. Update `status` in `.harness/feature-status.json` if a phase or feature completed.
3. Ensure no half-applied migrations or incomplete schema changes remain.

### Context Threshold (>50% utilization)

Compact the active `lld.md` → write `.harness/progress.md` → start a fresh session.
See `.ai/instructions/compaction.md`.

## Code

- Package manager: `pnpm` only — never `npm` or `yarn`.
- Lint reports: `reports/lint/` only. Command: `pnpm run lint:evaluate:json`.
- Schema: edit `prisma/schema.prisma` → `pnpm prisma migrate dev --name <name>` → commit both files together.

## Verification Gate

A task is **not done** until this sequence passes — run it, then show the terminal output:

1. `pnpm run type-check` — zero type errors
2. `pnpm run lint` — zero lint errors
3. `pnpm run build` — ask user to confirm (never run autonomously; see Hard Constraints)

_Excuse to reject: "it looks right / it should work" → wrong. Checks must pass and output must be shown._
For UI changes: describe what changed visually, or attach a screenshot.

## Subagents & Delegation

When `implement-from-spec` is active, the **orchestrator writes ZERO production code** — all phases go to `Next.js Expert` (haiku) agents. Every subagent prompt **must** include the `⚠️ CRITICAL CONSTRAINTS` block (explicit file list, no global lint/format, no auto-commit).

Full rules + model selection table + scope constraints block → `.ai/instructions/testing-and-subagents.md`.

## UI Rules (Recurring Issues)

- **Dark mode**: always add `dark:` variants for every color utility. See `.ai/instructions/dark-mode-and-react-select.md`.
- **react-select**: `unstyled` + `classNames` **const** (not a function). See same file.
- **Table headers**: use `THeadTH` component (`select-none cursor-default`). See `.ai/instructions/cursor-and-text-selection.md`.
- **Nested forms**: never `<form>` inside `<form>`. Use `createPortal`. See `.ai/instructions/form-patterns.md`.

---

## Canonical Instructions

All in `.ai/instructions/`. Grouped by **when** to reach for them — read before implementing.

| When                       | Files                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Touching DB / auth / infra | `auth.md` · `database-safety.md` · `dev-server-safety.md`                                                                                        |
| Building a feature         | `form-patterns.md` · `state-and-ui.md` · `middleware-and-icons.md` · `transaction-ledger-patterns.md` · `performance.md` · `product-owner-ux.md` |
| Building UI components     | `dark-mode-and-react-select.md` · `cursor-and-text-selection.md`                                                                                 |
| Planning / spec work       | `spec-structure.md` · `spec-consolidation.md` · `spec-implementation.md` · `spec-migration-map.md` · `migration-agent-template.md`               |
| Shipping / sessions        | `testing-and-subagents.md` · `compaction.md` · `git-worktree.md` · `deployment.md`                                                               |
| Meta / governance          | `instruction-governance.md`                                                                                                                      |

`.github/instructions/` contains Copilot **scoped** rules (`applyTo` frontmatter) — do not duplicate general rules there.
