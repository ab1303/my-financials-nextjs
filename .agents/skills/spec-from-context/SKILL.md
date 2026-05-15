---
name: spec-from-context
description: >
  Distil the current session conversation into a three-file spec bundle
  (context.md, hld.md, lld.md) under spec/{feature}/. Use when the user says
  "create a spec", "document this feature", "generate context/hld/lld",
  "hand this to context-engineer", or after a product discussion where a new
  feature or significant change has been identified. Triggers on: "create spec",
  "document under spec", "write up context hld lld", "generate spec files",
  "spec this out", "hand over to context engineer".
metadata:
  author: local
  version: "2.0.0"
  argument-hint: <feature-name>
---

# Spec From Context

Capture a feature discussed in this session and produce the three canonical spec
files used by all agents in this repo: `context.md`, `hld.md`, and `lld.md`
under `spec/{feature}/`.

---

## When to Use

Invoke this skill any time:
- A product or engineering discussion has surfaced a new feature with enough
  shape to document
- The user asks to "spec this out", "create the spec", or "document this"
- You are about to hand off to an implementation subagent and there is no
  existing spec to reference

---

## Step 1 — Determine the Feature Name

If the user provided a feature name as an argument (e.g. `/spec-from-context reimbursements`),
use it. Otherwise:
- Infer it from the session context (the dominant topic of the recent discussion)
- If ambiguous, ask the user with `ask_user` before proceeding

Normalise to kebab-case for the folder name (e.g. `reimbursement-tracking`).

---

## Step 2 — Gather Context from the Session

Before calling the subagent, compile a **context bundle** from the current
session. Include all of the following that are relevant:

### a) Problem Statement
Summarise the problem in 3–5 sentences:
- What is broken or missing today?
- What is the user's goal?
- What is the proposed solution?

### b) Architecture & Stack Facts
Pull from `CLAUDE.md`, `AGENTS.md`, and session history:
- Stack: Next.js 16 App Router, tRPC at `src/server/trpc/router/`, Prisma (`ctx.prisma`), NextAuth v5
- tRPC client: `import { trpc } from '@/server/trpc/client'`
- Toast: `import { toast } from 'sonner'`
- Package manager: `pnpm` only
- Any router/service patterns discussed in this session

### c) Relevant Schema
Read the Prisma schema for models relevant to this feature:
```
prisma/schema.prisma
```
Include exact model definitions and enums. Do NOT paraphrase — paste verbatim.

### d) Existing Files Inventory
Use `glob` and `grep` to find files that will be **modified** or **referenced**:
- Relevant tRPC routers, services, components, pages
- Shared utility files (constants, types, helpers)
- Any files already discussed in this session

### e) Design Decisions Already Made
List any explicit decisions from the conversation:
- Data model choices
- Naming conventions
- Out-of-scope items
- Phase boundaries (Phase 1 vs Phase 2)

### f) Existing Spec Files (if any)
If `spec/{feature}/` already has files, read them and include as "Prior art".

---

## Step 3 — Write the Three Spec Files Directly

Using **only** the context bundle compiled in Step 2, write all three files
yourself with the `create` tool. **Do not launch a subagent. Do not read any
additional files from the codebase.** All required information was gathered in
Step 2.

Create the spec directory first if it does not exist:
```powershell
New-Item -ItemType Directory -Path "spec\{feature}" -Force | Out-Null
```

Then call `create` three times **in parallel** (one per file):

### context.md must contain:
- Problem summary (2–3 sentences)
- File inventory table: files to CREATE vs files to MODIFY, with change description
- Schema details: verbatim Prisma model blocks, enum definitions, key relationships
- Existing patterns to reuse (tRPC router pattern, service pattern, component pattern)
- Data flow diagrams: current flow vs proposed flow (ASCII/text)
- Any known constraints or gotchas

### hld.md must contain:
- Problem + proposed solution (1–2 paragraphs)
- Numbered architecture decisions with rationale (minimum 5)
- Data model changes (schema diff)
- Component/service changes (high-level, not implementation detail)
- Success criteria (testable outcomes)
- Out of scope / future phases table

### lld.md must contain:
- Phase map table (Phase → files changed → description)
- Per-phase detail: exact TypeScript interfaces, Zod schemas, function signatures
- TDD test cases per phase (minimum 3 per phase) in tabular format:
  | Test description | Test type | What it verifies |
- Migration notes if schema changes are involved
- Integration points and edge cases

### Style rules (all three files):
- Use tables for file inventories and interface definitions
- Use fenced code blocks: `typescript`, `prisma`, `bash`
- Be thorough but not padded
- Match style of existing specs in `spec/transaction-ledger/`

---

## Step 4 — Verify and Report

After writing the files:

1. Run a quick sanity check:
   ```powershell
   Get-ChildItem spec\{feature}\ | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
   ```

2. Report to the user:
   - ✅ Files created with sizes
   - First heading of each file
   - Any content gaps noted

---

## Spec File Conventions (for this repo)

| Convention | Rule |
|---|---|
| Location | `spec/{kebab-case-feature}/` |
| File names | Exactly `context.md`, `hld.md`, `lld.md` |
| Phase naming | `Phase 1`, `Phase 2`, … (not Sprint/Milestone) |
| Out of scope | Always has its own section in hld.md |
| Code blocks | TypeScript uses `typescript`, Prisma uses `prisma`, shell uses `bash` |
| Tables | File inventories, interface definitions, test case lists |
| Style reference | `spec/transaction-ledger/` — use as the gold standard |

---

## Example Invocation

User: *"Spec this out under spec/reimbursements"*

1. Feature name → `reimbursements`
2. Gather context from session (problem, schema, files, decisions)
3. Create directory + write all three files directly with `create` tool (parallel)
4. Verify sizes + report back

Total time: ~30 seconds.
