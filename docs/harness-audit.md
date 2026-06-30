# Harness & Context Engineering — Audit Log

**Purpose:** Point-in-time findings only. Ratings, gaps, evidence, and prioritised actions against the state of this repo on a specific date.

**Companion document:** `docs/harness-learnings.md` holds the timeless framework (5-subsystem model, HumanLayer principles, templates). Read that first if you don't already know the rubric.

**Format:** Newest audit first. Older audits preserved verbatim — do not edit historical entries; superseded findings are visible as a delta against the current state.

---

## 2026-06-30 — Re-Audit (post-triage)

**Branch context:** `fix-linting` (pre-merge); spec-triage work delivered on `spec-triage` branch and merged.
**HEAD:** `fb4867f` (lint fixes / mock type safety).
**Manifest:** `spec/index.json` v0.1.0 @ `568c61bc`.
**Trigger for re-audit:** completion of overlap triage + Bucket A ownership backfill.

### Snapshot

| Metric                                   | 2026-06-29 baseline | 2026-06-30 today | Delta       |
| ---------------------------------------- | ------------------- | ---------------- | ----------- |
| Features tracked in machine manifest     | 0                   | **91**           | new         |
| Overlaps detected                        | undetectable        | **0**            | (was 15)    |
| `needsReview: true` features             | n/a                 | **0**            | (was 92)    |
| Features with `lastVerifiedSha`          | 0                   | **86 / 91**      | +94 %       |
| `ownsConfidence: high`                   | n/a                 | **45**           | —           |
| Legitimate empty `owns` (ADR + planned)  | n/a                 | **5**            | classified  |
| Drift findings (live signal)             | undetectable        | **50**           | now visible |
| Skills available                         | 9                   | **11**           | +SDD, +DDD  |

### Re-Scored Subsystem Ratings

| Subsystem            | 2026-06-29 | 2026-06-30 | Reason                                                                                                                                                |
| -------------------- | ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Instructions**     | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐⭐    | Already maxed. SDD/DDD skills deepen but don't change tier.                                                                                          |
| **State**            | ⭐⭐⭐⭐     | **⭐⭐⭐⭐½** | Manifest now connects features to code at file granularity. Stops short of 5 because capsules don't exist yet — high-traffic features still auto-load full LLDs. |
| **Verification**     | ⭐⭐⭐½     | **⭐⭐⭐⭐**   | `pnpm spec:check` is the third deterministic gate. Still no automated enforcement (Layer 2 pre-push hook pending) → not 5.                            |
| **Scope**            | ⭐⭐⭐⭐½   | **⭐⭐⭐⭐⭐**  | Boundary overlaps were the dominant scope failure — now 0. `owns[]` blocks are the machine-readable definition of done the original audit asked for.   |
| **Session Lifecycle**| ⭐⭐         | **⭐⭐⭐**    | Init hook + progress log present; session-end ritual still best-effort. Ungraceful-kill drift remains uncovered (Layer 2 missing).                     |

### What's Closed Since 2026-06-29

- **"No machine-readable index"** → `spec/index.json` with 91 features.
- **"No machine-readable definition of done per feature"** → `owns[]` per feature, file granularity.
- **"Boundary overlap / contradictory specs"** → 0 overlaps after triage (was 15).
- **"No drift detection"** → `pnpm spec:check` runs in <1 s, no LLM.
- **"21 instruction files but no programmatic retrieval"** → `spec/index.json` is the retrieval index.
- **"AGENTS.md doesn't tell agents how to orient on which spec governs which file"** → registered.
- **Cheap-model implementation fidelity** → two new skills (`source-driven-development`, `doubt-driven-development`) close the dominant cheap-model failure modes (fabricated APIs, unjustified confidence).

### Still Open

1. **Bucket B (21 features) need DDD-loop backfill.** Plan ready in `spec/index.backfill-plan.md`; not executed.
2. **Bucket E-adr schema decision** (3 options). Blocks Bucket B re-baseline.
3. **5 features with empty `owns[]`** correctly cover ADR + planned + retired-stub categories — but `'n/a-adr'` and `'n/a-planned'` are de-facto values, not yet declared in the manifest `conventions` block.
4. **50 drift findings unaddressed.** No mechanism decides whether to re-stamp `lastVerifiedSha` or update specs. First real test of "DDD-on-drift" workflow.
5. **No capsule format** for post-build features. LLDs span 14–724 lines; high-traffic features still auto-load full. Context-rot risk unchanged for those.
6. **Layer 2 enforcement not installed.** Local pre-push hook running `pnpm spec:check:strict` is the smallest meaningful gate.
7. **`status` / `phase` still `unknown` for all 91 features.** Manifest tracks ownership but not lifecycle phase → phase-driven loading rules not yet possible.

### Closed Since This Audit

- **Consumption signal restored (`harness.consumes-derivation`)** — the overlap remediation collapsed `owns[]` to a single canonical owner per file but silently discarded the *consumption* signal (feature B imports feature A's file). Added a third relation `consumes[]` to the manifest, deterministically derived from the TypeScript import graph by `scripts/harness/consumes-derivation/derive.mjs` (zero LLM at runtime). 93 features, 105 cross-feature edges discovered. `spec:check` overlap totals unchanged (still 0). Idempotent. Leaky-import report at `.harness/leaky-imports.md` surfaces cross-feature reaches into another feature's internals — informational signal for follow-up architectural cleanup.

### New Concerns Surfaced by the Data

- **Drift accumulation rate.** 50 drifts from ~4 commits = ~12 per commit. At this rate every PR will need spec touches. **Capsule format becomes a hard prerequisite for sustainable enforcement, not a nice-to-have.**
- **ADR schema decision is blocking.** Until decided, ADR features sit in an undeclared state.
- **`transactions.transactions` still owns 76 files post-triage.** Triage report flagged this as deferred. Latent boundary defect that will rebound the next time the transactions subsystem is touched.
- **4 features have `ownsConfidence: low`.** Not broken out in either report — worth a single-pass review.

### Priority Queue (replaces the 2026-06-29 list)

| # | Action                                                                                            | Subsystem      | Effort  | Blocks            |
| -:| ------------------------------------------------------------------------------------------------- | -------------- | ------- | ----------------- |
| 1 | **Resolve ADR schema decision** (3 options in backfill plan) — unblock Bucket E + manifest `conventions` | State          | Tiny    | #2, #3            |
| 2 | **Bucket B DDD backfill** (21 features) — sequential, Haiku per feature                            | State          | Medium  | #3                |
| 3 | **Re-baseline manifest** after #1 + #2 → 0 drift baseline, all features stamped                    | State          | Trivial | #4, #5, #6        |
| 4 | **Local pre-push hook** running `pnpm spec:check:strict`                                           | Verification   | Trivial | —                 |
| 5 | **Address the 50 drift findings** via a new drift triage runbook (same shape as overlap runbook)   | State + Lifecycle | Medium  | #6                |
| 6 | **Capsule generation runbook + script** for top-10 highest-traffic features                        | State          | Medium  | meaningful Layer 2 |
| 7 | **Scope-down `transactions.transactions`** to root concept (the deferred follow-up from triage)    | Scope          | Small   | —                 |
| 8 | **Session-end ritual addendum**: paste `spec:check` totals into progress entry as last action      | Lifecycle      | Trivial | —                 |
| 9 | **Encode `phase`** properly per feature (currently all `unknown`)                                  | State          | Small   | capsules earn keep |
| 10 | **Weekly local consolidation** (Layer 3) — `scripts/spec-weekly.mjs` opens drift report            | Lifecycle      | Small   | after #4–#6       |

### One-Sentence Verdict

**2026-06-29:** "you have advanced context engineering; you need to make it a harness."
**2026-06-30:** *you have a harness; you need to make its outputs load-bearing.*

The problem class has shifted from "where does state live?" to "which findings block the next commit?" That's a healthier question.

---

## 2026-06-29 — Initial Audit

**Scope:** First systematic audit of context engineering + harness engineering in this repo. Methodology and framework definitions have been moved to `docs/harness-learnings.md`; only findings remain below.

### Audit Ratings (initial)

| Area                              | Rating | Rationale                                                                                                   |
| --------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------- |
| Context Engineering (overall)     |    4/5 | Well-structured `spec/` and scoped instruction files; some repetitive guidance could be more machine-usable |
| Instruction Quality               |    5/5 | `AGENTS.md`, `.ai/instructions/`, and skills are explicit and prescriptive                                  |
| Context Slicing / Minimal Prompts |    4/5 | `implement-from-spec` enforces slice-first but mechanical enforcement is manual                             |
| RAG / Retrieval Support           |    3/5 | No central index or embeddings; retrieval is manual via spec files                                          |
| Harness Engineering (overall)     |    3/5 | Clear orchestration rules exist but missing persistent state and enforced verification gates                |
| Verification & Gates              |  3.5/5 | Guidance exists but no machine-verifiable artifacts required on completion                                  |
| Session Lifecycle & Resume        |    2/5 | No checkpointing, no `.harness` state, resumability is manual                                               |

### 5-Subsystem Scores (initial)

```
┌──────────────┐  ┌──────────────┐  ┌────────────────────┐
│ Instructions │  │    State     │  │   Verification     │
│  ⭐⭐⭐⭐⭐  │  │   ⭐⭐⭐⭐    │  │      ⭐⭐⭐½       │
└──────────────┘  └──────────────┘  └────────────────────┘
┌──────────────┐  ┌──────────────────────────────────────┐
│    Scope     │  │         Session Lifecycle            │
│   ⭐⭐⭐⭐½  │  │              ⭐⭐                    │
└──────────────┘  └──────────────────────────────────────┘
```

### 1. Instructions ⭐⭐⭐⭐⭐ (Excellent)

Progressive disclosure structure is textbook:

- `AGENTS.md` → universal operating manual
- `CLAUDE.md` / `GEMINI.md` → agent-specific persona
- `.ai/instructions/` → topic-specific deep dives (21 files)
- `.github/instructions/` → scoped `applyTo` rules
- `.agents/skills/` → invocable workflows
- `spec/{domain}/{feature}/` → implementation contracts

**One gap (addressed during audit):** `AGENTS.md` was verbose; pruned to a compact map with detail moved to `.ai/instructions/`.

### 2. State ⭐⭐⭐⭐ (Gap largely closed — 2026-06-29)

The original 2-star rating from the initial draft was raised after `.harness/` artifacts were created during the audit session:

| Harness Primitive                  | Coverage after 2026-06-29 session                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `feature_list.json`                | ✅ `.harness/feature-status.json` v1.1 — feature registry with rules + per-feature verification |
| `claude-progress.md`               | ✅ `.harness/progress.md` — newest-first session handoff log                                    |
| "Definition of done" per feature   | ✅ Encoded as `verification[]` + `evidence[]` in `feature-status.json`                          |
| `git log` reading at session start | ✅ `.harness/init.sh` injects branch, recent commits, last progress entry                       |
| Pre-session-end gate               | ✅ `.harness/clean-state-checklist.md`                                                          |
| Workflow rules for agents          | ✅ `.harness/README.md`                                                                         |

**Residual gap (at 2026-06-29):** no JSON Schema enforcing `feature-status.json` shape; no CI check rejecting `status: "done"` when `verification[].passing` flags are not all true. Documented as nice-to-haves.

### 3. Verification ⭐⭐⭐½ (Good Foundation, Not Automated)

Present:
- Validation Workflow defined: `type-check` → `lint` → `build`
- Subagent scope constraints prevent random test modifications
- e2e tests (Playwright), unit tests (Vitest)

Missing per the harness framework:
> "Only a passing test suite counts as evidence. The agent cannot declare victory without runnable proof."

Verification was *defined* but not *enforced as a gate*. The agent was told to run them, but no mechanism said "you cannot claim done until these pass."

**Addressed during audit:** Verification Gate added to `AGENTS.md` requiring agents to run the quick validation sequence and present command output as evidence before declaring complete.

### 4. Scope ⭐⭐⭐⭐½ (Very Strong)

Strengths:
- Spec-driven: one feature at a time via `implement-from-spec`
- Subagent hard-scoping: "You may ONLY modify these exact files"
- "One feature at a time" implicit in orchestration pattern
- `spec/{domain}/{feature}/lld.md` inherently scoped

Minor gap (open at 2026-06-29): no machine-readable definition of done per feature. The `lld.md` has acceptance criteria in prose; harness framework advocates a checkable list. Partially addressed by `feature-status.json` `verification[]`; still no file-granularity ownership.

### 5. Session Lifecycle ⭐⭐ (The Major Missing Piece)

Lifecycle coverage at start of audit:

| Lifecycle Step                             | Coverage                                |
| ------------------------------------------ | --------------------------------------- |
| 1. Read instructions                       | ✅ `AGENTS.md` auto-loaded              |
| 2. Run init (verify environment health)    | ❌ No `init.sh` or equivalent           |
| 3. Read progress (what happened last time) | ❌ No progress file                     |
| 4. Read feature list (what's done/next)    | ❌ No machine-readable status           |
| 5. Check git log (recent changes)          | ❌ Not instructed                       |
| 6. Pick ONE unfinished feature             | ⚠️ Manual (user tells agent what to do) |
| 12-16. Wrap up & handoff                   | ❌ No end-of-session protocol           |

**Addressed during audit:** `init.sh`, `progress.md`, `clean-state-checklist.md`, session start/end protocols in `AGENTS.md`.

### Prioritised Action Items (initial)

| Priority | Action                                                              | Subsystem        | Effort  | Status at end of 2026-06-29 |
| -------- | ------------------------------------------------------------------- | ---------------- | ------- | --------------------------- |
| 🔴 1      | Create `.harness/progress.md` + update protocol                     | State + Lifecycle | Small   | ✅ DONE                      |
| 🔴 2      | Add verification gate language ("report evidence")                  | Verification     | Trivial | ✅ DONE                      |
| 🔴 3      | Create `.harness/feature-status.json`                               | State + Scope    | Small   | ✅ DONE                      |
| 🟡 4      | Add session start/end protocol to `AGENTS.md`                       | Lifecycle        | Trivial | ✅ DONE                      |
| 🟡 5      | Prune `AGENTS.md` to ~80 lines, move rest to `.ai/`                 | Instructions     | Medium  | ✅ DONE                      |
| 🟡 6      | Add "definition of done" checklist per active feature                | Scope            | Ongoing | ✅ via `verification[]`      |
| 🟢 7      | Create `init` script (type-check + lint as health check)            | Lifecycle        | Small   | ✅ DONE                      |
| 🟢 8      | Instruct agents to read `git log --oneline -5` at session start     | State            | Trivial | ✅ DONE                      |

### Section A — Context Engineering (initial findings)

**Strengths:**
- Spec-first layout: `spec/{domain}/{feature}/context.md` + `lld.md` gives clear low-level contracts.
- Orchestrator SKILLs demand a slice-first approach and explicit pre-delegation declarations.

**Gaps & Risks (open at 2026-06-29):**
- No machine-readable index (feature list, embeddings, or TOC) to automate retrieval. → **Closed 2026-06-30** by `spec/index.json`.
- Ambiguity in how much of `AGENTS.md` to pass to subagents — large files increase token costs.

**Evidence:**
- `spec/transactions/hld.md` (domain HLD) — good canonical model excerpt.
- `.agents/skills/implement-from-spec/SKILL.md` — enforces slice-first and pre-delegation declaration.
- `.ai/instructions/spec-consolidation.md` — migration and spec hygiene guidance.

**Recommendations:**
1. Create `spec/feature-index.json` (basic metadata: domain, feature, hld/lld paths, tags). → **Done 2026-06-30** as `spec/index.json` with broader schema.
2. Add a short `context-template.md` in `.ai/` describing the exact minimal slice to pass to subagents.
3. Optional embeddings pipeline for larger features where retrieval matters.

### Section B — Harness Engineering (initial findings)

**Strengths:**
- Strong orchestration policies (`implement-from-spec` SKILL, `.ai/instructions/testing-and-subagents.md`).
- Hard scope constraints in subagent prompts.

**Gaps (initial — most closed during audit session):**
- Missing runtime state artifacts (`.harness/*`).
- No enforced verification artifact format.

**Concrete TODOs at 2026-06-29:**

| Priority | Action                                                                                          | Status                              |
| -------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| P0       | Add `.harness/feature-status.json` template and `.harness/README.md`                            | ✅ DONE                              |
| P0       | Add `reports/verification-schema.json` + enforce per-phase `reports/<feature>-verification.json` | ⏳ Pending (still open 2026-06-30)   |
| P1       | Add `scripts/init-harness.sh` to bootstrap `.harness`                                            | ⏳ Pending                           |
| P1       | Add `scripts/check-scope.js` — git-diff against allowed file list                                | ⏳ Pending                           |
| P2       | CI job `verify/harness-verification` validating `reports/*` against schema                       | ⏳ Pending (CI not yet adopted)      |

### Section C — HumanLayer Practices Scoring (initial)

| Practice                            | Repo state at 2026-06-29                          | Rating | Gap                                                                |
| ----------------------------------- | ------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| Research → Plan → Implement         | PRD mode + spec-first + `implement-from-spec`     |    4/5 | No explicit "research" phase artifact; PRD skips codebase research |
| Frequent Intentional Compaction     | Not instructed anywhere                           |    2/5 | No guidance on when/how to compact; no `progress.md` handoff       |
| High-Leverage Human Review          | `AGENTS.md` says "ask before commit"              |    3/5 | Review is on code/PR, not on research/plan                         |
| Sub-agents for context control      | `implement-from-spec` SKILL + strict file scoping |    5/5 | Excellent                                                          |
| Specs as first-class artifacts      | `spec/{domain}/{feature}/` committed              |    5/5 | Strong                                                             |
| Mental Alignment                    | Specs + domain HLDs                               |    4/5 | Missing: team-wide "what changed this week" artifact               |
| Context optimization                | Slice-first rule in SKILL                         |    4/5 | No explicit budget/utilization tracking                            |
| Three-tier risk classification      | Partial in `AGENTS.md`                            |    3/5 | Not formalised as a tiered model with examples                     |
| Phase-by-phase compaction           | Not present                                       |    1/5 | No instruction to compact progress back to plan after each phase   |
| Thoughts / external knowledge store | None                                              |    1/5 | No cross-session, cross-project knowledge sharing                  |

### Key Insight (initial): "The Compaction Gap"

Excellent **beginning** (instructions + specs) and **middle** (scoped implementation via subagents), but missing the **compaction discipline** that bridges phases and sessions. Diagram and template moved to `docs/harness-learnings.md`.

### HumanLayer-Inspired Action Items (initial)

| Priority | Action                                                              | Status               |
| -------- | ------------------------------------------------------------------- | -------------------- |
| 🔴 1      | Add compaction protocol to `.ai/instructions/compaction.md`         | ✅ DONE               |
| 🔴 2      | Formalise three-tier risk model in `AGENTS.md`                      | ✅ DONE               |
| 🔴 3      | Add phase-by-phase compaction to `implement-from-spec` SKILL         | ✅ DONE               |
| 🟡 4      | Add research phase (sub-agent + `thoughts/` output)                  | ⏳ Pending            |
| 🟡 5      | Adopt `TODO(0-4)` annotation system in contributing guide           | ⏳ Pending            |
| 🟡 6      | Create `.harness/progress.md` for session handoff                   | ✅ DONE               |
| 🟢 7      | Add "weekly alignment" summary artifact generation                  | ⏳ Pending (→ Layer 3) |
| 🟢 8      | Explore external "thoughts" repo for cross-project knowledge        | ⏳ Pending            |

### Initial Verdict (2026-06-29)

The harness is **architecturally sophisticated** — instruction layer and scope control rival anything in production. Optimised for the *single-session, human-supervised* workflow.

**The gap between sessions is where reliability dies.** Specs are excellent, subagent delegation is battle-tested, but no persistent state mechanism bridges sessions, and no structured lifecycle loop ensures the agent orients before acting and hands off before stopping.

**The gap between phases is where context degrades.** Workflow goes Instructions → Spec → Implement, but lacks the compaction step that writes progress back to the plan after each phase. Long features accumulate stale context and force cold-start re-orientation.

**Two lightweight bridges close the gap:**
1. **Between phases** — compaction protocol (write progress back to plan/lld after each phase).
2. **Between sessions** — session lifecycle protocol (`.harness/progress.md` + init/wrap-up).

### Appendix — Files Inspected (2026-06-29)

- `AGENTS.md`, `.agents/skills/implement-from-spec/SKILL.md`, `.ai/instructions/testing-and-subagents.md`
- `spec/transactions/hld.md`, `CLAUDE.md`, `GEMINI.md`
- `.ai/instructions/compaction.md`, `.ai/instructions/dev-server-safety.md`
- `.harness/feature-status.json`, `.harness/progress.md`, `.harness/README.md`
- `.github/copilot-instructions.md`, `docs/context-engineering.md`

### Verification Command (2026-06-29)

```bash
pnpm run type-check --silent && pnpm run lint --silent
```

(Augmented 2026-06-30 with: `pnpm spec:check --no-review`.)
