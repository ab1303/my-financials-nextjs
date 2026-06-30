# Spec Triage Runbook

**Purpose:** Resolve the boundary overlaps reported by `pnpm spec:check` —
files claimed by more than one feature in `spec/index.json`. Each overlap
is a feature-boundary defect that, if left unresolved, makes the manifest
untrustworthy and causes "which spec governs this file?" to have multiple
contradictory answers.

**Status of this runbook:** Living document. Update after each triage batch.
First execution: 2026-06-30 produced 15 overlaps to resolve.

> This is **not** a per-session ritual (those live in `AGENTS.md` § Session
> Lifecycle). This is a **multi-session, multi-model workflow** invoked
> deliberately when `spec:check` reports overlaps after a manifest regeneration.
> Same shape as `docs/lint-loop-runbook.md`.

---

## When to Invoke

- After running `node scripts/generate-spec-index.mjs` for the first time on a repo.
- After a feature is renamed / split / merged and `spec:check` raises new overlaps.
- After absorbing a large branch (squash-merge of many features) where ownership shifted.
- Whenever `spec:check --no-review` exits with `overlap > 0`.

Skip if `overlap === 0`. Skip if the only findings are `review` / `drift` /
`ghost` — those have their own resolution paths (review = ownership backfill,
drift = re-verify or update spec, ghost = remove from `owns[]`).

---

## Model Selection

This is the cheap-orchestrator workflow: the DDD skill carries the reasoning,
the manifest carries the data, and the orchestrator is just dispatching +
judging confidence. **Do not use a high-reasoning model as orchestrator.**

| Role                       | Recommended                       | Acceptable fallback         | Avoid                |
| -------------------------- | --------------------------------- | --------------------------- | -------------------- |
| Orchestrator               | Sonnet 4.6 `effort=medium`        | Sonnet 4.5, GPT-5.4 `medium`| Opus 4.7 (wrong tool)|
| Per-overlap subagent       | Haiku 4.5                         | GPT-5.4-mini `effort=high`  | Opus / Sonnet (waste)|
| Escalation for `confidence: low` cases | Sonnet 4.6 `effort=high`          | Opus 4.7 only if Sonnet stalls | —                |
| Apply step (rename/move files) | `Next.js Expert` (`gpt-5.4-mini`) via `implement-from-spec` | Sonnet 4.6 medium | Anything else        |

**Why not Opus for orchestration:** the DDD loop encodes the rubric, so the
model just executes a protocol. Anthropic's July 2025 "Context Rot" paper
shows reasoning models degrade *faster* past ~30K tokens on protocol-following
tasks. Opus at orchestrator costs 20–50× more for equal-or-worse output here.

---

## Workflow

### Step 0 — Pre-flight (in current session, before opening triage session)

- Confirm `spec/index.json` is current relative to HEAD:
  ```bash
  pnpm spec:check --no-review
  ```
  Note the count: this is the work envelope.
- If the manifest is stale, regenerate first: `pnpm spec:index -- --force`.
- Write a progress entry (newest-first) to `.harness/progress.md` referencing
  this runbook so the next session orients correctly.
- Park any other in-progress feature in `.harness/feature-status.json` —
  Single Active Feature rule.

### Step 1 — Open the triage session

Fresh chat session. Pick the orchestrator model from the table above.
Opening prompt template:

```
Goal: triage all overlaps reported by `pnpm spec:check --no-review --json`
using the doubt-driven-development skill.

Setup:
1. Run `bash .harness/init.sh` and read the latest entry of
   .harness/progress.md.
2. Read .agents/skills/doubt-driven-development/SKILL.md and
   .agents/skills/source-driven-development/SKILL.md.
3. Read spec/index.json's `overlaps` and `conventions` blocks.

Per overlap:
- Launch one Haiku 4.5 subagent (parallel batches of 5).
- Subagent contract: see Step 2 below.
- Collect JSON outputs.

Output:
- spec/index.triage.md  — ranked report (high-confidence first; low-confidence
  flagged for human review). Group recommendations by type
  (assign-A / assign-B / split / retire / merge).
- DO NOT modify any source file or spec file in this session.
- DO NOT regenerate spec/index.json.

Stop and ask the user when:
- More than 3 overlaps return `confidence: low` from their subagent.
- Any recommendation would touch > 10 files (escalate before drafting).
- A recommendation conflicts with an active feature in feature-status.json.
```

### Step 2 — Subagent prompt template (per overlap)

The orchestrator must pass each subagent a *self-contained* prompt because
subagents are stateless. Template:

```
You are running the doubt-driven-development loop on a single overlap.

Overlap:
  file:        {file}
  claimedBy:   [{idA}, {idB}]
  specA path:  {pathA from spec/index.json features[].docs}
  specB path:  {pathB}

Mandatory protocol: .agents/skills/doubt-driven-development/SKILL.md
Mandatory cite rules: .agents/skills/source-driven-development/SKILL.md

Required reads (in order, do not skim):
  1. {file}
  2. {pathA}/context.md (or lld.md if context.md missing)
  3. {pathB}/context.md (or lld.md if context.md missing)

Decide one of:
  - assign-to-A      file genuinely belongs to feature A; remove from B's owns
  - assign-to-B      file genuinely belongs to feature B; remove from A's owns
  - split            file straddles two real concerns; recommend extracting
                     subsection(s) into a new file
  - retire-one       one of the two features is dead / redundant / a catch-all
                     and should be retired or scoped down
  - merge            both features describe the same concept and should be
                     consolidated under one id

Output JSON ONLY, no prose around it:
{
  "file": "...",
  "claim": "single declarative sentence",
  "assumptions": ["a1", "a2", ...],
  "doubt": [{"n": 1, "mark": "✓|✗|?", "evidence": "file:line or test name"}, ...],
  "reconcile": "Proceed|Revise|Stop",
  "recommendation": "assign-to-A|assign-to-B|split|retire-one|merge",
  "rationale": "≤2 sentences citing the strongest evidence",
  "blastRadius": "files-touched if applied (integer)",
  "confidence": "low|medium|high"
}

`confidence: low` is correct and useful when any assumption stays `?` after
one doubt round — do not force a confident answer. Low-confidence outputs
get escalated, not silently merged.
```

### Step 3 — Orchestrator review

After all subagent JSON is collected, the orchestrator must:

1. **Sort** by `confidence` (low first) then `blastRadius` (high first).
2. **Write** `spec/index.triage.md` with three sections:
   - *Auto-approvable* (`confidence: high`, `blastRadius ≤ 3`) — likely safe.
   - *Needs human review* (`confidence: medium`, or `blastRadius > 3`).
   - *Escalation required* (`confidence: low`) — surface to user, may require
     larger model or fresh DDD pass.
3. **Stop**. Do not act on any recommendation in this session.

### Step 4 — Human approval pass

You (the user) read `spec/index.triage.md` and:

- ✓ each *Auto-approvable* recommendation (or reject individual ones).
- Decide each *Needs human review* item.
- For *Escalation required* items, either resolve in conversation or spawn a
  Sonnet 4.6 high-effort subagent with the same DDD contract.

### Step 5 — Apply (separate session, separate model)

Open a new session. Use `Next.js Expert` (`gpt-5.4-mini`) via
`implement-from-spec` pattern with one subagent per approved recommendation.
Each subagent gets the `⚠️ CRITICAL CONSTRAINTS` block per
`.ai/instructions/testing-and-subagents.md`:

- Explicit file list (the actual moves/renames).
- Update affected `spec/{domain}/{feature}/` docs (`lld.md`, `context.md`).
- No global lint or format runs.
- No auto-commit.

### Step 6 — Re-baseline

After all applies are merged:

```bash
node scripts/generate-spec-index.mjs --force
pnpm spec:check --no-review
```

Expected: `overlap === 0`. If non-zero, return to Step 4 with the residue.

Then, for each feature whose ownership is now confirmed clean, stamp:

```jsonc
"lastVerifiedSha": "<HEAD sha>",
"lastVerifiedDate": "<YYYY-MM-DD>",
"needsReview": false
```

Drift detection becomes live from this point forward.

---

## Cost Envelope (calibration from 2026-06-30 baseline)

For 15 overlaps in this repo:

| Step                          | Wall clock | Estimated cost (USD)       |
| ----------------------------- | ---------- | -------------------------- |
| Step 1 setup                  | 1–2 min    | ~$0.01 (orchestrator boot) |
| Step 2 — 15 Haiku subagents (parallel) | 2–4 min    | ~$0.20–0.50                |
| Step 3 review + report        | 1 min      | ~$0.05–0.15                |
| Step 4 human approval         | 5–15 min   | $0 (you)                   |
| Step 5 apply (15 × gpt-5.4-mini) | 5–10 min   | ~$0.30–0.80                |
| Step 6 re-baseline            | <1 min     | ~$0.01                     |
| **Total**                     | ~15–30 min | **~$0.60–1.50**            |

For comparison: doing the same work end-to-end with Opus 4.7 high-effort
in a single session would cost ~$8–12 and produce equal-or-worse outcomes
due to context rot past ~30K tokens.

---

## Anti-Rationalizations

| Excuse                                                          | Reality                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "Opus will just do better, let's not over-engineer."            | Decision tasks with explicit rubrics favour cheap models. Opus at orchestrator is paying for unused reasoning depth. |
| "Skip the JSON output, prose is easier to read."                | JSON enables sorting + auto-apply gating. Prose forces you to re-read 15 freeform recommendations.    |
| "Apply recommendations in the same session as triage."          | Conflates judgement with execution. The audit trail of "what was decided" gets tangled with "what was changed". Always separate. |
| "Just trust the high-confidence ones, no human review."         | Step 4 takes 5–15 minutes and catches the 1-in-15 case where the subagent's evidence looks solid but the recommendation is wrong. |
| "Regenerate `spec/index.json` between Step 5 and the next apply." | Generates noise. Re-baseline ONCE at Step 6 after all applies land.                                    |

---

## Red Flags

- More than 3 `confidence: low` outputs from a 15-overlap batch → manifest
  is more broken than you thought; consider whether feature granularity
  itself is wrong before continuing.
- A subagent recommendation that touches `> 10` files → likely a feature
  retirement or merge, not a simple reassignment. Escalate before drafting.
- A recommendation that conflicts with an active `in-progress` feature in
  `.harness/feature-status.json` → STOP, the active feature has priority.
- `spec:check` after Step 6 still shows overlaps → the apply step had a bug
  or a recommendation was wrong; do NOT loop blindly — investigate.

---

## Verification

This runbook executed correctly when:

- [ ] `pnpm spec:check --no-review` exits with `overlap === 0` after Step 6.
- [ ] Every feature touched has `needsReview: false` and a fresh
      `lastVerifiedSha`.
- [ ] `spec/index.triage.md` is committed as audit trail (or moved to
      `docs/lessons/` if you prefer not to keep triage logs in `spec/`).
- [ ] `.harness/progress.md` has a new entry summarising the batch with the
      count of overlaps resolved and any deferred items.
