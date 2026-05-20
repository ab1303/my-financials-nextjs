# Spec Folder Migration Guide

**Purpose:** Document how to migrate existing `spec/{feature}/` folders to the new `spec/{domain}/{feature}/` structure with proper HLD/context/LLD organization.

**Model recommendation:** Use `gpt-4.1` for migrations — it's 60% faster than Sonnet and sufficient for this mechanical restructuring task.

---

## When to Migrate

Migrate a spec when:
- You are actively working on that feature (implementation, debugging, updates)
- As part of a domain refactor (e.g., grouping all `transactions` features)
- During routine maintenance

**Do not** proactively migrate all 48 specs — let it happen opportunistically.

---

## Migration Checklist (Manual Setup)

Before delegating to a cheaper model agent, you prepare:

1. **Identify the domain** — consult `spec-migration-map.md` for the target domain
2. **Read the current spec** — gather what exists in old `spec/{feature}/` folder
3. **Understand the feature** — what does it do, what domain concepts does it rely on?
4. **List key decisions** — what are the locked architectural decisions?

Example for `transfer-reconciliation` → `spec/transactions/transfer-reconciliation/`:
- Domain: `transactions` (already has `hld.md` with Transaction, Transfer models)
- Current files: `hld.md`, `lld.md`, context from discussion
- Key decision: LLM classifies transfers by pattern matching
- Schema: References `Transaction`, `TransferMatch` models (in domain HLD)

---

## Agent Task Template: Migrate One Domain

Use this template to delegate migration to a cheaper model (gpt-4.1):

```
You are a spec migration specialist. Migrate the following features from old structure
to the new 2-level spec tree structure.

⚠️ MODEL SELECTION: Use gpt-4.1 for this task (mechanical restructuring, cost-effective).

## Context

### Old Structure
spec/transactions/        (flat, mixed files)
spec/transfer-reconciliation/
spec/transaction-ledger/
spec/clear-transactions/
... etc

### New Structure (Target)
spec/transactions/
  hld.md                  ← domain-level (shared schema, patterns)
  transactions/
    context.md            ← what this feature does
    lld.md                ← implementation detail
  transfer-reconciliation/
    context.md
    lld.md
  ... etc

### AGENTS.md Reference
The new spec structure is documented in AGENTS.md § Spec Documents:
- hld.md (domain): Shared schema, architecture decisions, patterns
- context.md (feature): Problem, domain dependencies, scope boundary (NO file inventory)
- lld.md (feature): Interfaces, schemas, API contracts, tests, **file inventory moves here**

## Files to Migrate

### Domain HLD (CREATE NEW)
Create spec/transactions/hld.md by merging/extracting from existing specs:
- Read: spec/transactions/hld.md (old), spec/transaction-ledger/hld.md, etc.
- Extract: Transaction model, Transfer model, shared patterns
- Write: spec/transactions/hld.md (new location, consolidated)

### Features (REORGANIZE EACH)
For each feature below, reorganize into spec/transactions/{feature}/:

1. **transactions** → spec/transactions/transactions/
   - Old: spec/transactions/hld.md, spec/transactions/lld.md
   - New: spec/transactions/transactions/context.md, spec/transactions/transactions/lld.md
   - context.md: Problem (universal import hub), domain dependencies → (none, this IS the domain)
   - lld.md: Existing lld.md content + file inventory table

2. **transaction-ledger** → spec/transactions/transaction-ledger/
   - Old: spec/transaction-ledger/hld.md, spec/transaction-ledger/lld.md
   - New: spec/transactions/transaction-ledger/context.md, spec/transactions/transaction-ledger/lld.md
   - context.md: What is ledger view? What Transaction fields does it display?
   - lld.md: Existing lld.md + file inventory

... (repeat for each feature in transactions domain)

## Instructions

1. **Read the old specs** (all files in old locations)
2. **Extract domain HLD** — consolidate shared schema and decisions
3. **For each feature, create context.md** using this template:

```markdown
# {Feature} — Context

## Problem
{2-3 sentence summary of what this feature does}

## Domain Dependencies
- Uses: Transaction, Transfer models from domain HLD
- Patterns: {any shared patterns from domain HLD}
- Related features: {sibling features in same domain}

## Scope
**In scope:**
- ...

**Out of scope:**
- ...

## Known Constraints
- ...
```

4. **Reorganize lld.md** — add file inventory table to lld.md if not present:

```markdown
## Files
| File | Action | Description |
|---|---|---|
| src/server/trpc/router/transactions.ts | MODIFY | Add {feature} procedure |
| src/app/(authorized)/cashflow/transactions/_components/LedgerTable.tsx | CREATE | Ledger view component |
```

5. **Test the structure** — verify:
   - spec/transactions/hld.md exists (domain-level)
   - spec/transactions/{feature}/context.md exists (feature-level)
   - spec/transactions/{feature}/lld.md exists (feature-level)
   - All 3 files are readable and coherent

6. **Report back with:**
   - ✅ Domain: transactions
   - ✅ Features migrated: 9
   - ✅ Domain HLD: spec/transactions/hld.md (size)
   - ✅ Feature specs: 9 × (context.md + lld.md)
   - 📝 Any structural issues or questions

⚠️ CRITICAL CONSTRAINTS:
- DO NOT create new files outside spec/transactions/
- DO NOT delete old spec/ folders (orchestrator will rm -rf after validation)
- DO NOT modify code files (only spec docs)
- DO NOT run build/lint
- DO NOT commit changes (orchestrator handles git)
```

---

## Orchestrator Handoff (After Agent Completes)

After the agent reports completion:

1. **Verify structure** — browse `spec/transactions/` manually
2. **Quick validation** — ensure no duplication, all 3 files present
3. **Git workflow:**
   ```bash
   git add spec/transactions/
   git rm -rf spec/transactions/ spec/transaction-ledger/ ... (old folders)
   git commit -m "refactor: migrate transactions domain to new spec structure

   - Consolidate domain HLD at spec/transactions/hld.md
   - Reorganize 9 features under spec/transactions/{feature}/
   - context.md: Problem + domain dependencies (no file inventory)
   - lld.md: Implementation + file inventory

   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
   ```

4. **Document learnings:**
   - Time taken (compare to estimate)
   - Any edge cases discovered
   - Update spec-migration-map.md with completion status

---

## Pilot: Migrate `transactions` Domain

**Scope:** 9 features under new `transactions` domain  
**Model:** gpt-4.1  
**Estimated time:** ~3–5 minutes  
**Effort after agent:** ~5 min validation + git

### Pilot Success Criteria

- ✅ All 9 feature specs migrated to `spec/transactions/{feature}/`
- ✅ Domain `spec/transactions/hld.md` consolidated and coherent
- ✅ Each feature has `context.md` (problem + domain deps) and `lld.md` (implementation + files)
- ✅ No duplication between domain HLD and feature context.md
- ✅ No file inventory in context.md (all in lld.md)
- ✅ Time estimate for bulk migration updated

---

## Bulk Migration (After Pilot Learnings)

Once pilot is validated:
- Apply same process to remaining 39 features
- Group by domain (csv-import, banking, categories, etc.)
- Delegate each domain migration to gpt-4.1 background agent
- Total estimated time: ~90 minutes agent work + ~60 minutes validation

