---
name: spec-from-context
description: >
  Distil the current session conversation into a spec bundle under spec/{domain}/{feature}/.
  Generates hld.md (domain-level if grouped features, or feature-level if standalone), 
  context.md, and lld.md. Uses 2-level structure by default; notes when 3-level (with 
  sub-features) may be needed. Triggers on: "create spec", "document this feature", 
  "spec this out", "hand over to context engineer".
metadata:
  author: local
  version: "3.0.0"
  argument-hint: <feature-name> [domain-name]
---

# Spec From Context

Capture a feature discussed in this session and produce the canonical spec bundle
used by all agents: `hld.md`, `context.md`, and `lld.md` under `spec/{domain}/{feature}/`
or `spec/standalone/{feature}/` (for truly independent features).

Follows the 2-level default structure (domain + feature). Notes when 3-level (with 
sub-features) may be beneficial for future promotion.

---

## When to Use

Invoke this skill any time:
- A product or engineering discussion has surfaced a new feature with enough shape to document
- The user asks to "spec this out", "create the spec", or "document this"
- You are about to hand off to an implementation subagent and there is no existing spec to reference
- **An agent is assigned to work on an existing feature and its spec is in the old location** — use this to migrate it to the new structure (also see AGENTS.md § Spec Migration)

### Spec Migration Context

If a feature already exists but its spec is at `spec/{feature}/` (old flat location), this skill can also migrate it:
1. Consolidate old hld.md + lld.md + any context files into the new structure
2. Extract domain HLD (write once per domain)
3. Create feature-level context.md (problem + scope, no file inventory)
4. Reorganize feature-level lld.md (implementation + file inventory)

Migration is typically done as part of starting work on that feature (see AGENTS.md for workflow).

---

## Step 1 — Determine Feature Name and Domain

**Feature name**: If provided as an argument, use it. Otherwise infer from session.
Normalise to kebab-case (e.g. `transfer-reconciliation`).

**Domain grouping**: Ask the user:
- Does this feature logically group with other features? (e.g., "transfers" groups with "transactions")
- If yes → Domain name (e.g. `transactions`)
- If no → Use `standalone` as the domain

The resulting path will be `spec/{domain}/{feature}/` or `spec/standalone/{feature}/`.

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

### c) Domain Context (if grouped)
**Only if feature groups with others** in the same domain:
- Does the domain already have a `spec/{domain}/hld.md`? (Read it if yes.)
- What shared models/patterns exist? (e.g., Transaction model, Import pattern)
- If domain HLD exists, you will reference it; do NOT duplicate it in feature context.md

### d) Relevant Schema
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
If `spec/{domain}/{feature}/` or `spec/{domain}/hld.md` already exist, read and include as "Prior art".

---

## Step 3 — Delegate Spec Writing to a Cheap Model

The expensive work (reading files, analysing schema, forming decisions) is done.
The writing is mechanical. **Always delegate to `gpt-4.1`** — it produces the
same quality spec at a fraction of the cost.

Create the spec directory first:
```powershell
New-Item -ItemType Directory -Path "spec\{domain}\{feature}" -Force | Out-Null
```

Then launch a **single background `general-purpose` subagent** with `model: "gpt-4.1"`,
passing the full context bundle inline. The agent writes all three files using the `create` 
tool. **Do not read any additional files from the codebase** — all required information 
must be in the prompt.

### Subagent prompt template

```
You are writing a spec bundle for the feature: {feature} in domain: {domain}.
Create all three files under spec/{domain}/{feature}/ using the `create` tool.

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

### Domain Context (if domain HLD exists, reference it; do NOT duplicate schema)
{domain_hld_summary_or_link}

### Relevant Schema (verbatim — use exactly as provided)
{prisma_model_blocks}

### Files to Modify/Create
{file_inventory}

### Design Decisions Already Made
{decisions_list}

### Prior Spec (if any)
{existing_spec_content}

## File Requirements

### hld.md must contain (domain-level if new domain, feature-level if standalone):
- Problem + proposed solution (1–2 paragraphs)
- Numbered architecture decisions with rationale (minimum 5)
- Data model changes (schema diff)
- Component/service changes (high-level)
- Success criteria (testable outcomes)
- Out of scope / future phases table

### context.md must contain:
- Problem summary (2–3 sentences)
- Domain dependencies (links to hld.md sections if domain HLD exists)
- Scope boundary: explicitly list what is IN scope and OUT of scope
- Schema references (link to domain hld.md or verbatim if standalone)
- Existing patterns to reuse (tRPC, service, component patterns)
- Known constraints or gotchas
⚠️ DO NOT include file inventory — that belongs in lld.md

### lld.md must contain:
- Phase map table (Phase → files changed → description)
- Per-phase: exact TypeScript interfaces, Zod schemas, function signatures
- TDD test cases per phase (minimum 3) as table: | Test | Type | Verifies |
- Migration notes if schema changes involved
- Integration points and edge cases
- File inventory table: files to CREATE vs MODIFY with change description

## Style Rules
- Tables for file inventories and interface definitions
- Fenced code blocks: `typescript`, `prisma`, `bash`
- Thorough but not padded
- Match style of existing specs in spec/transactions/transaction-ledger/
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
| Location | `spec/{domain}/{feature}/` or `spec/standalone/{feature}/` |
| File names | Exactly `hld.md`, `context.md`, `lld.md` |
| Promotion trigger | Promote to 3-level if feature has 3+ independently-delegatable phases |
| Sub-feature naming | Verb-noun format: `match-transfers/`, `review-ui/`, `parse-csv/` |
| Phase naming | `Phase 1`, `Phase 2`, … (not Sprint/Milestone) |
| Out of scope | Always has its own section in hld.md or context.md |
| Code blocks | TypeScript uses `typescript`, Prisma uses `prisma`, shell uses `bash` |
| Tables | File inventories, interface definitions, test case lists |
| Style reference | `spec/transactions/transaction-ledger/` — use as the gold standard |

---

## Example Invocation

User: *"Spec this out as a transactions feature"*

1. Feature name → `transfer-matching` (or similar)
2. Domain → `transactions` (asked/inferred)
3. Gather context from session (problem, schema, files, decisions)
4. Create `spec/transactions/transfer-matching/` + write all three files
5. Verify sizes + report back; note if future 3-level promotion would help

Total time: ~30 seconds.
