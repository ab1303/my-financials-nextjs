# AGENTS.md

Universal rules for AI agents working in this repo. Detail lives in `.ai/instructions/` — read on demand, not on every turn. Scoped rules (auto-loaded by file pattern) live in `.github/instructions/*.instructions.md`. Claude-specific MCP tool config: `CLAUDE.md`. Never duplicate rules across files — define once, link from elsewhere.

## Operation Risk Tiers

| Tier | Examples | Gate |
| --- | --- | --- |
| **1 — Always OK** | Read files, type-check, lint, search, `git log` | None |
| **2 — Ask First** | Edit source, modify specs, run migrations, create branches | Confirm plan |
| **3 — Never Autonomous** | `git push`, `git reset --hard`, `prisma migrate reset`, deploy, delete data | Explicit user confirmation + verification evidence |

When in doubt, escalate one tier.

## Hard Constraints (non-negotiable landmines)

- **No auto-commit/push.** Every `git commit` and `git push` requires explicit user confirmation.
- **Never `prisma db push`.** Always `pnpm prisma migrate dev --name <name>`. `db push` causes irreversible schema drift.
- **Never auto-kill the dev server.** After `pnpm run build`, ask the user to Ctrl+C and restart manually.
- **DB scope is `my-financials-nextjs` only.** Never list or query other DBs (e.g. `CapacityDb`).
- **`pnpm` only.** Never `npm`, never `yarn`.
- **Lint reports → `reports/lint/` only.** Command: `pnpm run lint:evaluate:json`.
- **Schema commits**: edit `prisma/schema.prisma` → `pnpm prisma migrate dev --name <name>` → commit schema + migration together.
- **New features**: follow `prd-mode` workflow before writing code. Never jump straight to implementation.

## Verification Gate

A task is **not done** until this passes and the terminal output is shown:

1. `pnpm run type-check` — zero type errors
2. `pnpm run lint` — zero lint errors
3. `pnpm run build` — ask the user before running

For UI changes: describe the visual change or attach a screenshot.

## Session Lifecycle

- **Start.** `.github/hooks/hooks.json` runs `bash .harness/init.sh` and injects active feature + last progress entry into your initial context. If the hook didn't fire, run it manually. Read the active feature's `spec/{domain}/{feature}/lld.md` before editing code. Announce: "Last session worked on X. Continuing from Y."
- **End.** Walk `.harness/clean-state-checklist.md`. Update `verification[]` / `evidence[]` in `.harness/feature-status.json`. Append a new entry (newest first) to `.harness/progress.md`. A feature becomes `status: "done"` only when every `verification[].passing === true`.
- **Context >50%.** Compact the active `lld.md` → write progress entry → start fresh session. Protocol: `.ai/instructions/compaction.md`.

`plan.md` is session-only — never commit. Specs live under `spec/{domain}/{feature}/`. `spec/index.json` is the machine-readable ownership + drift manifest — consult it before touching any source file to see which feature claims it (`pnpm spec:check` flags drift and boundary overlaps).

## Subagents

When `implement-from-spec` is active, the orchestrator writes **zero production code** — every phase is delegated to a `Next.js Expert` (`gpt-5.4-mini`) subagent. Every subagent prompt must include the `⚠️ CRITICAL CONSTRAINTS` block (explicit file list, no global lint/format, no auto-commit). Full rules + model table: `.ai/instructions/testing-and-subagents.md`.

Two skills are mandatory for small/cheap-model implementation work:

- **`source-driven-development`** — cite-or-flag gate for every framework API call. Prevents hallucinated Prisma / NextAuth / tRPC symbols. Invoke during *build* phase.
- **`doubt-driven-development`** — CLAIM → EXTRACT → DOUBT → RECONCILE → STOP loop. Mandatory before any Tier 3 op, schema migration, or `spec:check` drift resolution.

## UI Rules (recurring landmines)

- **Dark mode**: every color utility needs a `dark:` variant.
- **react-select**: `unstyled` + `classNames` as a **const** (never a function).
- **Table headers**: use the `THeadTH` component (`select-none cursor-default`).
- **Nested forms**: never `<form>` inside `<form>`. Use `createPortal`.

## Anti-Rationalization

Reject these thoughts, every time:

- *"I'll just restart the dev server."* → No. Ask the user.
- *"`db push` is faster than a migration."* → No. It causes drift; always `migrate dev`.
- *"It looks right / it should work."* → No. Run the Verification Gate and show output.
- *"This commit is small, I'll just push."* → No. Every push needs explicit user confirmation.
- *"I'll skip the spec for this one."* → No. New features require `prd-mode` first.
- *"I'll gather more context before doing anything."* → No. Read the active `lld.md`, then act.

## Environment

Windows 11. Use `bash` for shell commands. Never `echo` / `Out-File` / `mkdir` from the shell — use workspace file tools. Paths use `\` backslashes. Pass `--quiet` / `--silent` to `pnpm` and `prisma`.

---

Detail (read on demand): `.ai/instructions/`. Scoped (auto-loaded): `.github/instructions/`.
