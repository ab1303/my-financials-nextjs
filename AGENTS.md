# AGENTS.md — Agent Behaviour Rules

Rules for AI agents (Copilot, Claude, Gemini, etc.) working in this repository.

---

## Efficiency

- **Do not delegate context you already have.** If you have already read the relevant files and built up context in the current session, write the output directly. Only launch a sub-agent to read the codebase when you genuinely have not read the files yourself.
- **Pre-load context before launching agents.** If a sub-agent is needed, read all relevant files yourself first and pass the content directly in the agent prompt. Do not instruct the agent to read the codebase on your behalf when the information is already in your context window.
- **Batch parallel reads.** When you need multiple files, read them all in a single response turn using parallel tool calls — not sequentially across multiple turns.

## Planning

- All spec and PRD files go in `spec/{feature}/` at the project root.
- Write a `plan.md` in the session workspace for multi-phase tasks. Do not create planning markdown files inside the repository.
- Use the SQL session database to track todo status during implementation.

## Spec Document Types and When to Use Them

Each feature in `spec/{feature}/` has three document types with distinct purposes:

| Document | Purpose | Audience |
|---|---|---|
| `context.md` | Full codebase-grounded detail: file inventory, schema discrepancies, exact patterns, appendices. The **authoring artifact** — used to generate HLD + LLD. | Authors only |
| `hld.md` | Architecture overview: problem, solution, data model, data flows, decisions, migration phases, out-of-scope. The **mental model** document. | PO/PM review; agent orientation |
| `lld.md` | Task-scoped implementation specs: organised by phase + task. Exact TypeScript interfaces, Zod schemas, API contracts, DB write patterns, component diffs. The **execution** document. | Implementing agents |

### Optimal Context Bundle Per Task Type

> **Never pass all three documents simultaneously.** That is redundant — once HLD + LLD exist, `context.md` adds no unique information and burns context window unnecessarily.

| What you are doing | Pass this |
|---|---|
| Architecture review / planning | `hld.md` only |
| Implementing a full phase (e.g. Phase A) | `hld.md` + Phase A section of `lld.md` |
| Implementing a single task (e.g. task A2) | That task section from `lld.md` only |
| Starting fresh in a new session | `plan.md` + `hld.md`, then ask which phase to start — then add the relevant `lld.md` section |
| Debugging / investigating a bug | `lld.md` prerequisites/schema section + the specific files involved |

### Rule: HLD + scoped LLD section is the sweet spot
The HLD gives the agent the mental model (why, what, how it fits together).  
The targeted LLD section gives exact specs (no need to invent or guess).  
Together they are sufficient — more is noise.

## Code

- Always use `pnpm` — never `npm` or `yarn`.
- Run `pnpm run build` before declaring any feature complete.
- Stop the dev server before any Prisma CLI operation (prevents EPERM on Windows).
- Never run `prisma migrate reset` without explicit user consent and confirmed backup.
