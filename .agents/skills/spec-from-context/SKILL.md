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

## Step 3 — Delegate Spec Writing to a Cheap Model

The expensive work (reading files, analysing schema, forming decisions) is done.
The writing is mechanical. **Always delegate to `gpt-4.1`** — it produces the
same quality spec at a fraction of the cost.

Create the spec directory first:
```powershell
New-Item -ItemType Directory -Path "spec\{feature}" -Force | Out-Null
```

Then launch a **single background `general-purpose` subagent** with `model: "gpt-4.1"`,
passing the full context bundle inline. The agent must write all three files
using the `create` tool. **Do not read any additional files from the codebase** —
all required information must be in the prompt.

### Subagent prompt template

```
You are writing a three-file spec bundle for the feature: {feature}.
Create all three files under spec/{feature}/ using the `create` tool.

⚠️ CRITICAL: **DO NOT READ ANY FILES FROM THE CODEBASE.** Do not use grep, glob, or view.
All required context is provided below. Use ONLY the context provided; invent nothing.

## Context Bundle (Complete — Do Not Research)

### Problem Statement
{problem_statement}

### Architecture & Stack
- Next.js 16 App Router, tRPC at src/server/trpc/router/, Prisma, NextAuth v5
- Package manager: pnpm only
- tRPC client: import { trpc } from '@/server/trpc/client'
- Toast: import { toast } from 'sonner'

### Relevant Schema (verbatim — use exactly as provided)
{prisma_model_blocks}

### Files to Modify/Create
{file_inventory}

### Design Decisions Already Made
{decisions_list}

### Prior Spec (if any)
{existing_spec_content}

## File Requirements

### context.md must contain:
- Problem summary (2–3 sentences)
- File inventory table: files to CREATE vs MODIFY with change description
- Schema details: verbatim Prisma model blocks (from context above), enum definitions, relationships
- Existing patterns to reuse (tRPC router, service, component patterns)
- Data flow diagrams: current vs proposed (ASCII)
- Known constraints or gotchas

### hld.md must contain:
- Problem + proposed solution (1–2 paragraphs)
- Numbered architecture decisions with rationale (minimum 5)
- Data model changes (schema diff)
- Component/service changes (high-level)
- Success criteria (testable outcomes)
- Out of scope / future phases table

### lld.md must contain:
- Phase map table (Phase → files changed → description)
- Per-phase: exact TypeScript interfaces, Zod schemas, function signatures
- TDD test cases per phase (minimum 3) as table: | Test | Type | Verifies |
- Migration notes if schema changes involved
- Integration points and edge cases

## Style Rules
- Tables for file inventories and interface definitions
- Fenced code blocks: `typescript`, `prisma`, `bash`
- Thorough but not padded
- Match style of existing specs in spec/transaction-ledger/
```

### Critical Guard Rails

✅ **DO**:
- Write from the context bundle provided
- Create all three files with the `create` tool
- Use the exact schema blocks provided
- Reference file paths from the inventory provided

❌ **DO NOT**:
- Call `grep`, `glob`, or `view` to read files
- Search the codebase for additional context
- Invent schema or file paths not mentioned in the context bundle
- Ask for more context or clarification — assume the bundle is complete

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
