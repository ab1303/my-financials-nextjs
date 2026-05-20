# Spec Consolidation Checklist

**When to use:** An agent is about to work on a feature whose spec is in the old location (`spec/{feature}/`).

---

## Pre-Work: Check Spec Location

### Step 1: Determine if Migration is Needed

```
Does spec/{domain}/{feature}/ exist?
  ✅ YES → Use it. No migration needed.
  ❌ NO  → Continue to Step 2

Does spec/{feature}/ exist in old location?
  ✅ YES → Migration needed. Continue to Step 2.
  ❌ NO  → Feature is unspec'd. Create new spec using spec-from-context skill.
```

### Step 2: Check Domain Assignment

Look up the feature in `.github/instructions/spec-migration-map.md`:
- Find its target domain (e.g., `transfer-reconciliation` → `transactions` domain)
- Note the target path: `spec/{domain}/{feature}/`

Example:
```
Feature: transfer-reconciliation
Domain: transactions
Target: spec/transactions/transfer-reconciliation/
Old location: spec/transfer-reconciliation/
```

---

## Migration: Consolidation Workflow

**Who does it:** A gpt-4.1 background agent (cost-effective for mechanical consolidation)  
**What it does:** Read old spec, consolidate into new 2-level structure, create files  
**Who validates:** Main agent (you) — verify structure, no duplication, all files present  

### Steps

1. **Collect old spec files**
   - Read: `spec/{feature}/hld.md`, `spec/{feature}/lld.md`, `spec/{feature}/context.md` (if any)
   - Also check for summaries, implementation notes, etc.

2. **Delegate to gpt-4.1 agent**
   - Use template from `.github/instructions/migration-agent-template.md` § "Agent Task Template: Migrate One Domain"
   - Pass all old spec content to the agent
   - Agent reads, consolidates, creates new files

3. **Validate the migration**
   - ✅ Domain HLD exists: `spec/{domain}/hld.md`
   - ✅ Feature context exists: `spec/{domain}/{feature}/context.md`
   - ✅ Feature lld exists: `spec/{domain}/{feature}/lld.md`
   - ✅ No duplication between domain HLD and feature context.md
   - ✅ File inventory in lld.md only (not context.md)
   - ✅ All files are readable and coherent

4. **Commit the migration**
   ```bash
   git add spec/{domain}/{feature}/
   git commit -m "refactor: migrate {feature} spec to new structure
   
   - Consolidate domain HLD at spec/{domain}/hld.md
   - Reorganize feature spec under spec/{domain}/{feature}/
   - context.md: Problem + domain dependencies
   - lld.md: Implementation + file inventory
   
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
   ```

5. **Clean up old location** (CRITICAL — must be done)
   - Delete `spec/{feature}/` (old flat folder)
   - Keep new `spec/{domain}/{feature}/` (new location)
   - **Do not skip this step** — duplicates cause confusion and break the new structure

---

## What Gets Consolidated

| Old Location | New Location | What Stays |
|---|---|---|
| `spec/{feature}/hld.md` | `spec/{domain}/hld.md` | Shared models, architecture decisions, patterns |
| `spec/{feature}/lld.md` | `spec/{domain}/{feature}/lld.md` | Implementation detail, interfaces, schemas, tests, file inventory |
| `spec/{feature}/context.md` | `spec/{domain}/{feature}/context.md` | Problem statement, domain dependencies, scope boundary |
| `spec/{feature}/*_SUMMARY.md` | Archived or discarded | Historical implementation notes (not canonical) |

---

## Example: Transfer Reconciliation

**Old state:**
```
spec/transfer-reconciliation/
  hld.md           ← Transfer model, matching patterns
  lld.md           ← Phase 1A, 1B, 2 implementation
  implementation-summary.md  ← Historical notes
```

**New state after consolidation:**
```
spec/transactions/
  hld.md           ← Transaction + Transfer models, shared patterns
  transfer-reconciliation/
    context.md     ← "Reconcile transfers between accounts"
    lld.md         ← Phase 1A, 1B, 2 implementation + file inventory
```

**What changed:**
- ✅ Transfer model moved to domain HLD (written once)
- ✅ context.md created (problem + domain deps)
- ✅ lld.md reorganized (implementation + files)
- ✅ Old summary discarded (historical artifact)

---

## Decision Tree: Should I Migrate?

```
You're starting work on feature X.

↓ Is X already in spec/{domain}/{feature}/?
  ✅ YES → Use it as-is, skip migration
  ❌ NO  → Continue

↓ Is X in old spec/{feature}/ location?
  ✅ YES → Migrate it (follow steps above)
  ❌ NO  → X is unspec'd, create new spec

↓ After migration:
  ✅ Structure valid? → Proceed with implementation
  ❌ Errors? → Fix with agent, re-validate
```

---

## Questions?

- **Where's the domain for feature Y?** → Check `.github/instructions/spec-migration-map.md`
- **How do I migrate?** → Use template in `.github/instructions/migration-agent-template.md`
- **What's the new spec structure?** → See `AGENTS.md` § Spec Documents
- **When do I migrate?** → When you start work on that feature (see `AGENTS.md` § Spec Migration)
