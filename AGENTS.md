# AGENTS.md

Rules for all AI agents working in this repository.

---

## Efficiency

- Read files yourself before delegating — only launch sub-agents for work you haven't done.
- Pass file content directly in sub-agent prompts; don't tell them to read the codebase.
- Batch all independent file reads into one parallel tool-call turn.

## Planning

- Spec and PRD files → `spec/{feature}/` only.
- `plan.md` → session workspace only; never commit planning files to the repo.
- Track todo status in the SQL session database throughout implementation.

## Spec Documents

Three document types per feature in `spec/{feature}/`:

| File | Content | Use when |
|---|---|---|
| `context.md` | File inventory, schema details, exact patterns | Authoring HLD/LLD |
| `hld.md` | Architecture, data model, decisions, out-of-scope | Planning, agent orientation |
| `lld.md` | Phase/task specs: interfaces, schemas, API contracts, DB patterns | Implementing |

**Context bundle by task:**

| Task | Pass |
|---|---|
| Architecture review | `hld.md` |
| Implement a phase | `hld.md` + that phase's `lld.md` section |
| Implement a single task | That task's `lld.md` section only |
| New session | `plan.md` + `hld.md`, then scoped `lld.md` on request |
| Debug | Relevant `lld.md` section + affected files |

Never pass all three docs at once — `context.md` is redundant once HLD + LLD exist.

## Code

- Use `pnpm` exclusively — never `npm` or `yarn`.
- Run `pnpm run build` before marking any feature complete.
- Stop the dev server before any Prisma CLI operation (prevents EPERM on Windows).
- Never run `prisma migrate reset` without explicit user consent and a confirmed backup.

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

