# Spec Structure Evolution — Decision Record

**Date:** 2026-05-20  
**Status:** Accepted  
**Decision Maker:** User + Copilot discussion  

---

## Problem

The current spec tree (48 flat `spec/{feature}/` folders) was designed with horizontal layering (context.md, hld.md, lld.md at every level). This created:

1. **Fragmentation** — An LLM working on a feature reads 3 files saying overlapping things
2. **Noise** — Features like `csv-import` have 8 files (implementations, fixes, summaries); only 3 are canonical
3. **Duplication risk** — Context repeated across domains (e.g., Transaction schema described in 8 different specs)
4. **LLM context overhead** — Sending all 3 files is wasteful for simple features; not sending is risky for complex ones

---

## Solution: 2-Level Default, 3-Level on Demand

### New Structure

**Level 1: Domain** (optional, only if features group)
- `spec/{domain}/hld.md` — shared schema, patterns, decisions (written once)

**Level 2: Feature** (always)
- `spec/{domain}/{feature}/context.md` — problem, domain deps, scope boundary (no file inventory)
- `spec/{domain}/{feature}/lld.md` — implementation detail, interfaces, file inventory, tests

**Level 3: Sub-feature** (only if 3+ independent phases)
- `spec/{domain}/{feature}/{sub-feature}/lld.md` — atomic vertical slice for one phase

### Why This Works

✅ **Vertical slicing** — each document is a cohesive "slice" through the feature, not a layer  
✅ **No duplication** — Transaction schema in domain HLD only, referenced by features  
✅ **Adaptive depth** — Simple features use 2 levels; complex features promote to 3  
✅ **LLM-friendly** — Send atomic docs: problem alone (context.md), or implementation alone (lld.md), or both  

---

## Implementation

### 1. Updated AGENTS.md
- Describes 2-level default, 3-level promotion rule
- Tree shapes for each structure type
- Document responsibilities with "Never contains" column
- Context bundle by task (what to send to LLMs)

### 2. Updated spec-from-context Skill
- Asks for domain grouping upfront
- References domain HLD to prevent duplication
- Generates 2-level structure by default
- Notes when 3-level promotion may be needed

### 3. Migration Map & Guide
- `spec-migration-map.md` — all 48 features grouped by domain
- `MIGRATION_GUIDE.md` — how to migrate using cheaper models (gpt-4.1)

### 4. Model Recommendations
For migration work (mechanical restructuring):
- **Do not** use Sonnet (overkill)
- **Use** gpt-4.1 (60% faster, sufficient reasoning)
- **Validate** with Haiku after agent completes

---

## Migration Strategy

### Phase 1: Plan (✅ Complete)
- ✅ AGENTS.md updated
- ✅ spec-from-context skill updated  
- ✅ spec-migration-map.md created
- ✅ MIGRATION_GUIDE.md created

### Phase 2: Pilot (Next)
Migrate `transactions` domain (9 features) to validate structure:
- Consolidate domain HLD
- Reorganize 9 features into 2-level structure
- Document learnings
- Estimated time: ~5 min with gpt-4.1 + 5 min validation

### Phase 3: Selective Migration (Ongoing)
- Migrate specs opportunistically as features are touched
- No forced bulk migration
- Each migration is a separate "refactor" commit

### Phase 4: Cleanup (Future)
- Archive old noise files (summaries, fix notes)
- Move truly standalone features to `spec/standalone/`

---

## Decisions Locked

| Decision | Rationale | Reversible? |
|---|---|---|
| 2-level default | Balances simplicity with flexibility. 3-level only when earned. | Yes, but would require re-spec of all features |
| Vertical slicing at all levels | Aligns with Dex Horthy paradigm; improves LLM context precision | Yes, but reduces LLM effectiveness |
| Domain HLD written once | Eliminates duplication, forces architectural clarity | Yes, but increases risk of orphaned docs |
| File inventory in lld.md only | Forces thinking about implementation scope; reduces context.md noise | Yes, but requires careful lld.md maintenance |
| 3-level sub-features verb-noun named | Prevents layer re-emergence (`schema/`, `api/`, `ui/`) | No, should be enforced |
| Use gpt-4.1 for migrations | Cost/speed tradeoff for mechanical work; acceptable for restructuring | Yes, can use Sonnet if needed |

---

## Rollout Timeline

| Phase | Target | Owner | Estimated Time |
|---|---|---|---|
| Plan | Complete | ✅ Done | — |
| Pilot | spec/transactions domain | gpt-4.1 agent | 5 min + 5 min validation |
| Validation | Assess learnings | Copilot | 10 min |
| Selective | Active features as touched | Various agents | Ongoing |
| Bulk (optional) | Remaining 39 specs | gpt-4.1 agents | ~90 min total |
| Cleanup | Archive old noise files | Copilot | ~20 min |

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Migration introduces errors | Pilot first, validate structure, use cheap model (lower stake) |
| Inconsistent domain grouping | Migration map locks all 48 features upfront |
| Orphaned domain HLDs | Domain HLD only written when features exist; removed when last feature moves |
| context.md → file inventory creep | AGENTS.md has "Never contains" guard; spec-from-context skill enforces |
| LLM confusion on new structure | AGENTS.md updated; all agents briefed; context bundles in AGENTS.md table |

---

## References

- **AGENTS.md § Spec Documents** — New structure definition
- **spec-migration-map.md** — All 48 features with target domains
- **MIGRATION_GUIDE.md** — How to execute migration with cheaper models
- **Video inspiration** — Dex Horthy on vertical slicing (YouTube link in session discussion)

---

## Next Action

**Proceed with pilot migration of `transactions` domain:**
- Use gpt-4.1 background agent
- Follow template in MIGRATION_GUIDE.md
- Report back with learnings and updated time estimate

Approve? (User to confirm before launching pilot)

