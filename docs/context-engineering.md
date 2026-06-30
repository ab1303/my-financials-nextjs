# Context Engineering Structure

Maps every folder and file that shapes how AI agents behave in this repository.
**For humans**: understand where to add new content.
**For agents**: understand which file owns what, and which files are automatically loaded vs. on-demand.

---

## Loading Mechanism Map

| Location                                 | Loaded by                      | When                            | Role                                                                                                                    |
| ---------------------------------------- | ------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                              | All agents                     | Every session — auto            | Universal entry point: risk tiers, hard constraints, session lifecycle, verification gate, anti-rationalization         |
| `CLAUDE.md`                              | Claude Code / Copilot (Claude) | Every session — auto            | Claude-specific MCP tool config (Playwright / Prisma / Postgres MCP)                                                    |
| `.github/copilot-instructions.md`        | GitHub Copilot                 | Every session — auto            | Thin pointer to `AGENTS.md` — no duplicated content                                                                     |
| `.github/instructions/*.instructions.md` | GitHub Copilot                 | Auto on `applyTo` file match    | File-scoped rules — injected only when editing a matching file                                                          |
| `.github/agents/*.agent.md`              | GitHub Copilot                 | On `@agent-name` invocation     | Custom specialist personas (e.g. `@expert-react-frontend-engineer`)                                                     |
| `.ai/instructions/*.md`                  | Any agent                      | On-demand — discoverable by `ls` | Deep-dive topic docs — agents list this directory when they need detail on a topic                                     |
| `.agents/skills/*/SKILL.md`              | Copilot / Claude Code          | On skill invocation             | Invocable multi-step workflow definitions                                                                               |
| `.harness/progress.md`                   | Any agent                      | Session start — required        | Human-readable session handoff log (newest entry first)                                                                 |
| `.harness/feature-status.json`           | Any agent                      | Session start — required        | Machine-readable feature registry                                                                                       |
| `.harness/README.md`                     | Any agent                      | On demand                       | Schema and workflow rules for the `.harness/` directory                                                                 |
| `spec/index.json`                        | Any agent + `pnpm spec:check`  | On demand / pre-edit            | Machine-readable spec↔code ownership manifest. Lists which feature owns which source file, drift sha, overlaps          |

---

## Folder Details

### `AGENTS.md` / `CLAUDE.md` — Root Level

**Always loaded.** The first thing any agent reads. `AGENTS.md` is the single source of truth for universal rules; every agent (Claude Code, Copilot, Gemini CLI, Cursor) reads it. `CLAUDE.md` holds only Claude-specific MCP tool configuration.

- Add a rule to `AGENTS.md` only if it applies to **all agents** and would cause mistakes if absent.
- For topic detail (>10 lines), put it in `.ai/instructions/<topic>.md`. Agents discover those files by listing the directory; do not maintain an index.
- `CLAUDE.md` holds only Claude-specific tweaks (MCP tools). Never duplicate `AGENTS.md` rules.

---

### `.github/` — Platform: GitHub Copilot

Copilot-specific files. Nothing here should duplicate `AGENTS.md`.

| File                                                               | `applyTo`                                     | Purpose                                                           |
| ------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------- |
| `copilot-instructions.md`                                          | Always                                        | Thin pointer to `AGENTS.md`                                       |
| `instructions/reimbursement-patterns.instructions.md`              | `transaction-ledger.ts`, `TransactionRow.tsx` | Feature-specific patterns — auto-injected on matching files       |
| `agents/expert-react-frontend-engineer.agent.md`                   | `@expert-react-frontend-engineer`             | Specialist React reviewer persona                                 |
| `agents/Prd.chatmode.md`                                           | Chat mode                                     | PRD generation workflow                                           |

**Add here when:** The content is Copilot-specific, OR it needs `applyTo` file-scoped auto-injection. Not for general rules.

---

### `.ai/instructions/` — Universal Deep-Dive Docs

**Platform-agnostic.** Works with any agent that reads `AGENTS.md`. Loaded **on-demand** — agents discover relevant files by listing this directory (filenames are descriptive) and reading what's needed for the current task. **There is no maintained index** — adding/removing files requires no other changes.

**Add here when:** You have detailed guidance (>10 lines) for a specific topic. Pick a clear, descriptive kebab-case filename and write the content. Don't add it to any index.

---

### `.agents/skills/` — Invocable Workflows

**Skill definitions.** Not reference docs — step-by-step workflows agents follow when explicitly invoked by name.

| Skill                         | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `implement-from-spec`         | Orchestrate multi-phase spec implementation via subagents |
| `spec-from-context`           | Distil a conversation into a spec bundle under `spec/`    |
| `ai-sdk`                      | AI SDK usage (generateText, streamText, useChat, tools)   |
| `vercel-react-best-practices` | React/Next.js performance and patterns                    |
| `vercel-composition-patterns` | Component composition and compound patterns               |
| `web-design-guidelines`       | UI accessibility and design audit                         |
| `source-driven-development`   | Cite-or-flag gate for framework APIs (build-phase)        |
| `doubt-driven-development`    | CLAIM→EXTRACT→DOUBT→RECONCILE loop for Tier 3 / drift     |

**Add here when:** You have a repeatable multi-step workflow with clear entry/exit criteria that agents invoke by name. Follow the SKILL.md anatomy: Overview → When to Use → Process → Anti-Rationalization → Verification.

---

### `.harness/` — Session State

**Machine-readable session continuity.** Agents read this at session start; write to it at session end.

| File                  | Purpose                                     | Format                                |
| --------------------- | ------------------------------------------- | ------------------------------------- |
| `progress.md`         | Session handoff log — newest entry first    | Markdown (see `README.md` for format) |
| `feature-status.json` | Feature registry with branch, status, phase | JSON                                  |
| `README.md`           | Schema docs and workflow rules for agents   | Markdown                              |

**Rule:** Agents **must** read `progress.md` at session start and write to it at session end. `plan.md` files are session-only — never commit them.

---

## Decision: Where Does New Content Go?

| Content type                                            | Destination                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Universal rule (all agents, causes mistakes if missing) | `AGENTS.md` inline                                                       |
| Detailed topic guidance (>10 lines)                     | `.ai/instructions/<topic>.md` (no index required)                        |
| Claude-only MCP / tool config                           | `CLAUDE.md`                                                              |
| Copilot-only behaviour                                  | `.github/copilot-instructions.md`                                        |
| File-scoped rule (auto-inject on edit)                  | `.github/instructions/<name>.instructions.md` with `applyTo` frontmatter |
| Invocable multi-step workflow                           | `.agents/skills/<name>/SKILL.md`                                         |
| Specialist agent persona                                | `.github/agents/<name>.agent.md`                                         |
| Session state / progress                                | `.harness/`                                                              |
| Lessons and post-mortems                                | `docs/lessons/`                                                          |
