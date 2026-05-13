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

## Shared Components

- Components used by more than one feature belong in `src/components/`, not inside any feature's `_components/` folder.
- Before deleting a feature directory, grep `src/` for all imports of its files. Extract anything imported outside the feature to `src/components/` first.
- A file at `feature-a/_components/foo.tsx` is owned by `feature-a`. Cross-feature imports are hidden dependencies — they break silently on cleanup.

