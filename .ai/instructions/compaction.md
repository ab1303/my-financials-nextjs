# Compaction Protocol

> Source: HumanLayer "Advanced Context Engineering for Coding Agents" — Frequent Intentional Compaction.

Compaction is the practice of **distilling the current session's progress into structured artifacts before context fills up**, so the next agent or session starts with a precise, clean context window rather than a cold start.

---

## When to Compact

Compact at any of these triggers — whichever comes first:

| Trigger                                 | Action                                              |
| --------------------------------------- | --------------------------------------------------- |
| Context window estimated > 50% utilized | Start a new session with the compacted artifacts    |
| An implementation phase completes       | Write phase summary back into the plan/lld          |
| A session ends (planned or unplanned)   | Write session handoff to `.harness/progress.md`     |
| A research or planning step is approved | Commit the artifact to `thoughts/` before moving on |

The goal is to keep context utilization in the **40–60% range** for complex tasks.

---

## Phase Compaction (after each implementation phase)

After an agent completes a phase, the orchestrator must update the spec artifacts **before** launching the next phase. Do not accumulate multiple phases of progress before writing back.

**What to write into the plan/lld:**

```markdown
### Phase N — {name} ✅ COMPLETE

**Completed steps:**

- ✅ Created `src/server/services/foo.service.ts`
- ✅ Added `createFoo` tRPC procedure to `foo.ts` router
- ✅ Tests passing: `src/__tests__/unit/foo.service.test.ts`

**Deviations from plan:**

- Used `upsert` instead of `create` — existing record check not needed

**Next phase starts at:**

- Read `src/server/trpc/router/foo.ts` (updated by Phase N)
```

---

## Session Compaction (end of session or context threshold)

Before ending any session or starting a new one, write a 5–8 line entry to `.harness/progress.md`:

```markdown
## {YYYY-MM-DD} — {feature/branch}

**Done this session:**

- Implemented Phase 1 (Prisma migration) and Phase 2 (service layer)
- Both verified: type-check ✅ lint ✅

**Not yet done:**

- Phase 3 (tRPC router) — not started
- Phase 4 (UI) — blocked on Phase 3

**Current blockers:**

- None / {describe any blockers}

**Next session starts at:**

- Read `spec/{domain}/{feature}/lld.md` § Phase 3
- Read `.harness/progress.md` (this entry)
- Run `git log --oneline -5` to confirm working state
```

---

## Research Compaction (after research sub-agent)

When a research sub-agent completes, its output goes to `thoughts/{feature}-research.md`. The orchestrator must:

1. Read the research output.
2. If incorrect or incomplete — discard and restart with tighter steering.
3. If correct — commit `thoughts/{feature}-research.md` before planning begins.
4. Reference the research file path in the planning prompt.

Do NOT carry raw research output forward into the implementation context — it floods the context window with low-signal grep/search noise.

---

## What Compaction Removes

| Noise to discard             | What to keep                                              |
| ---------------------------- | --------------------------------------------------------- |
| Glob/grep search outputs     | Filenames and line numbers of relevant files              |
| Full file reads              | Only the specific functions/sections the next phase needs |
| Build/test logs              | Only pass/fail status and any failing test names          |
| Large JSON blobs             | Only the keys/values relevant to the next step            |
| Back-and-forth clarification | The final decision and its rationale                      |

---

## Anti-patterns

- ❌ Carrying a full 500-line file into a follow-up prompt because "it might be needed"
- ❌ Skipping compaction because "the context is only at 30% — plenty of room"
- ❌ Starting a new session without writing `.harness/progress.md` first
- ❌ Writing compaction after 3+ phases have completed — by then context is already degraded
- ❌ Using the compaction step to add scope — compaction only distils; it never adds new goals
