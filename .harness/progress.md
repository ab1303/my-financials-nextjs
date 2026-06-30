# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-06-30 — Harness spec-remediation — PIPELINE COMPLETE ✅

**Workstream:** `spec/index.json` overlap remediation — **ALL 3 PIPELINE STEPS DONE. Awaiting commit.**

### Final state

| Metric | Before | After |
|---|---|---|
| `overlap-files` | 94 | **0** |
| `overlap-parts` | 223 | **0** |
| Total patches applied | — | **127** (steps 1-3, 5 discover rounds) |

All four `verification[].passing` entries in `.harness/feature-status.json` are now `true`.
`harness.spec-remediation` status set to `"done"` in `spec/index.json`.
`lastVerifiedSha` set to `cb49a9c019e5bdde82510b5fb9eb9470488ea8bc`.

### One remaining action (Tier 3 — requires explicit user confirmation)

**Ask the user to commit:**

```bash
git add spec/index.json .harness/remediation/ .harness/feature-status.json \
  scripts/harness/spec-remediation/ spec/harness/spec-remediation/lld.md
git commit -m "chore(spec): remediate all ownership overlaps in spec/index.json

overlap-files 94→0, overlap-parts 223→0 across 3 pipeline steps.
- Step 1 (scope-down): 13 tasks, 9 effective patches
- Step 2 (invariant reclassify): 3 tasks
- Step 3 (boundary decisions): 94 original + 33 residual = 127 total patches
- Rollback gate switched to overlap-participations (strictly monotone)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

After committing, re-stamp `lastVerifiedSha` in `spec/index.json` with the new HEAD SHA.

### Pending drift item

`scripts/harness/spec-remediation/render-prompt.mjs` is now registered in `spec/index.json::harness.spec-remediation.owns.services` (line 1885). No outstanding drift.

---

## ⏭️ Next workstream — `harness.consumes-derivation`

Spec'd in a separate session: **`spec/harness/consumes-derivation/`** (`context.md` + `lld.md`).

**Why this is next:** the just-completed remediation achieved `overlap-parts=0` by forcing single-author selection on every shared file. Legitimate consumer relationships (e.g. feature B imports a `<Button>` owned by feature A) are now machine-invisible — `spec:check` cannot tell apart "shared use" from "ownership conflict".

**Approach:** derive a `consumes[]` field on each feature from the **static import graph** of `src/` (source of truth: code imports, not LLD prose, which is stale post-remediation). `spec:check` continues to compute overlaps from `owns[]` only; `consumes[]` is informational.

**Key design points (from the LLD):**
- New script `scripts/harness/consumes-derivation/derive.mjs` walks TS imports, resolves via tsconfig paths, reverse-indexes `file → owning feature`, emits per-feature `consumes[]`.
- No LLM in the runtime loop — sub-agents are only used to author the scripts during build.
- Manifest schema gains `consumes[]` but no semantics change for overlap detection.

The next session starts there. This spec-remediation workstream is **done**; no further action on it.


