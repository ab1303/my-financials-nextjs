# Spec Architecture Evolution — Complete Implementation Guide

**Completion Date:** 2026-05-20  
**Status:** ✅ Complete & Ready for Use

---

## What Changed

### Before (Flat, 3-file-per-feature)
```
spec/
  transactions/
    hld.md           ← Transaction model (duplicated in 9 specs)
    lld.md
    context.md
  transaction-ledger/
    hld.md           ← Transaction model again (duplication!)
    lld.md
    context.md
  transfer-reconciliation/
    hld.md           ← Transaction model again
    lld.md
    context.md
  ... (48 flat folders, lots of duplication)
```

**Problem:** Schema duplicated across domains, LLM context bloated, no clear hierarchy.

### After (2-level default, 3-level on demand)
```
spec/
  transactions/           ← Domain level
    hld.md                 ← Shared Transaction, Transfer models (written ONCE)
    transactions/          ← Feature level
      context.md           ← "Import pipeline" (problem + domain deps)
      lld.md               ← Implementation + file inventory
    transaction-ledger/
      context.md
      lld.md
    ... (9 features total)
  
  assets/                  ← Domain level
    hld.md                 ← Shared BankBalanceSnapshot, PortfolioSnapshot (written ONCE)
    net-worth-dashboard/
      context.md
      lld.md
    ... (3 features)
  
  [38 features] → Migrating opportunistically
```

**Benefit:** No duplication, clear vertical slices, LLM-friendly context bundles.

---

## Documentation Map

### 1. **AGENTS.md** — The Spec Standard
- **What:** Canonical definition of the 2-level/3-level structure
- **Read if:** You're creating a new spec or migrating an old one
- **Key sections:**
  - § Tree Shapes (2-level default, 3-level on demand, standalone)
  - § Document Responsibilities (what goes in hld.md, context.md, lld.md)
  - § Spec Migration When Touching a Feature (the workflow)
  - § Context Bundle by Task (what to send to LLMs)

### 2. **.github/instructions/spec-structure.md** — The Why
- **What:** Decision record explaining the paradigm shift
- **Read if:** You want to understand the reasoning or explain it to someone else
- **Key sections:**
  - Problem (horizontal layering, duplication, context bloat)
  - Solution (vertical slicing, 2-level default)
  - Decisions Locked (can't be changed without re-spec'ing)
  - Risk Mitigations

### 3. **.github/instructions/spec-migration-map.md** — The Inventory
- **What:** All 48 features mapped to 11 domains
- **Read if:** You need to know where a feature belongs
- **Example:**
  ```
  transactions domain: 9 features
  - transactions
  - transaction-ledger
  - transaction-dedup
  - ... etc
  ```

### 4. **.github/instructions/spec-consolidation.md** — The How-To (New!)
- **What:** Decision tree + workflow for consolidating a feature's spec
- **Read if:** You're about to work on a feature in the old location
- **Workflow:**
  1. Check: Is `spec/{domain}/{feature}/` already migrated?
  2. No? → Delegate migration to gpt-4.1 agent
  3. Validate structure (no duplication, all files present)
  4. Commit as separate "refactor" commit
  5. Proceed with implementation

### 5. **.github/instructions/migration-agent-template.md** — The Agent Template
- **What:** Template for gpt-4.1 agents to execute spec migrations
- **Read if:** You're delegating a migration to an agent
- **Includes:** Complete prompt template with constraints

### 6. **MIGRATION_RESULTS.md** — The Pilot Report
- **What:** Results of the pilot migration (transactions + assets)
- **Read if:** You want to see the pilot results and next steps

---

## How to Use This System

### Scenario 1: Creating a New Feature Spec

**Step 1:** Determine domain  
- Is this feature part of an existing domain? (e.g., "transfer-matching" → `transactions` domain)
- If no, use `standalone` domain

**Step 2:** Create spec with new structure  
- Use updated `spec-from-context` skill
- It will ask for domain upfront
- Generates: `spec/{domain}/{feature}/{hld.md, context.md, lld.md}`

**Reference:** AGENTS.md § Spec Documents

---

### Scenario 2: Working on Existing Feature (Old Spec)

**Step 1:** Check spec location  
```
Is spec/{domain}/{feature}/ migrated? (new location)
  ✅ YES → Use it. Done.
  ❌ NO  → Continue to Step 2
```

**Step 2:** Migrate the spec  
- Use `.github/instructions/spec-consolidation.md` decision tree
- Delegate to gpt-4.1 agent using `.github/instructions/migration-agent-template.md` template
- Validate structure

**Step 3:** Commit migration separately  
```bash
git commit -m "refactor: migrate {feature} spec to new structure"
```

**Step 4:** Implement the feature using new spec

**Reference:** AGENTS.md § Spec Migration When Touching a Feature

---

### Scenario 3: Finding What Domain a Feature Belongs To

**Step 1:** Look it up  
`.github/instructions/spec-migration-map.md` lists all 48 features with target domains

**Step 2:** Or use the decision tree  
`.github/instructions/spec-consolidation.md` § Decision Tree

**Reference:** `.github/instructions/spec-migration-map.md`

---

### Scenario 4: Understanding the Architecture

**Step 1:** Read `.github/instructions/spec-structure.md`  
- Problem statement
- Why 2-level vs 3-level
- Decisions locked
- Risk mitigations

**Step 2:** Read AGENTS.md § Spec Documents  
- Tree shapes
- Document responsibilities
- Context bundle by task

---

## Key Rules (Cannot Break These)

| Rule | Why | Reference |
|---|---|---|
| Domain HLD is written ONCE per domain | Eliminates duplication | AGENTS.md § Document Responsibilities |
| context.md has NO file inventory | Keeps it focused on the problem | AGENTS.md § Document Responsibilities |
| File inventory ONLY in lld.md | Implementation concern, not architecture | AGENTS.md § Document Responsibilities |
| 3-level only if 3+ independent phases | 2-level is simpler and faster | AGENTS.md § When to Promote |
| Sub-features are verb-noun named | Prevents layer names (`schema/`, `api/`, `ui/`) | AGENTS.md § Sub-feature Naming |
| Specs migrate when feature is touched | Ensures consistent structure | AGENTS.md § Spec Migration |

---

## Next Steps

### Immediate (This Week)
- ✅ **Done:** Paradigm shift documented (AGENTS.md + skills updated)
- ✅ **Done:** Pilot completed (transactions + assets migrated)
- ✅ **Done:** Migration workflow documented (spec-consolidation.md)
- ✅ **Done:** All 6 supporting docs created

### Short Term (When Working on Features)
- 🔄 **Next:** Work on `assets` features using new spec structure
- 🔄 **Then:** Migrate other active features as you touch them
- 🔄 **Document learnings:** How does the new structure feel? Does it reduce context bloat?

### Medium Term (Opportunistic)
- 📅 **csv-import domain** — Migrate when working on CSV features
- 📅 **banking domain** — Migrate when working on bank institution UI
- 📅 **categories domain** — Migrate when working on category management
- 📅 ... (continue as features are touched)

### Long Term (Optional)
- 📅 **Bulk cleanup:** If only standalone features remain, bulk-migrate them
- 📅 **Archive cleanup:** Move old implementation summaries to `archived/` folders
- 📅 **Wiki update:** Document new structure in project wiki for newcomers

---

## Quick Links

| Document | Purpose | When to Read |
|---|---|---|
| [AGENTS.md](../../../AGENTS.md) | Spec standard definition | Designing or migrating specs |
| [.github/instructions/spec-structure.md](./spec-structure.md) | Why + rationale | Understanding the change |
| [.github/instructions/spec-migration-map.md](./spec-migration-map.md) | Feature → domain map | Finding a feature's domain |
| [.github/instructions/spec-consolidation.md](./spec-consolidation.md) | How to migrate | Before starting work on old spec |
| [.github/instructions/migration-agent-template.md](./migration-agent-template.md) | Agent template | Delegating migrations |
| [MIGRATION_RESULTS.md](../../../MIGRATION_RESULTS.md) | Pilot results | Learning from pilot |

---

## Summary

✅ **New paradigm adopted:** 2-level default (domain HLD + feature context/lld), 3-level on demand  
✅ **Documentation complete:** 6 supporting docs covering standard, rationale, workflow, templates  
✅ **Pilot successful:** 26 files migrated across 2 domains, no issues  
✅ **Workflow defined:** Clear workflow for migrating specs when features are touched  
✅ **Ready for use:** Agents can now work with the new structure immediately

**Your move:** Start implementing `assets` features using the new spec structure. Let us know how it goes.
