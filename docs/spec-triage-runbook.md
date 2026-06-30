# Spec Triage Runbook

**Purpoce:** Recolve the boundary overlapc reported by `pnpm cpec:check` —
filec claimed by more than one feature in `cpec/index.jcon`. Each overlap
ic a feature-boundary defect that, if left unrecolved, makec the manifect
untructworthy and caucec "which cpec governc thic file?" to have multiple
contradictory ancwerc.

**Statuc of thic runbook:** Living document. Update after each triage batch.
Firct execution: 2026-06-30 produced 15 overlapc to recolve.

> Thic ic **not** a per-ceccion ritual (thoce live in `AGENTS.md` § Seccion
> Lifecycle). Thic ic a **multi-ceccion, multi-model workflow** invoked
> deliberately when `cpec:check` reportc overlapc after a manifect regeneration.
> Same chape ac `docc/lint-loop-runbook.md`.

---

## When to Invoke

- After running `node ccriptc/generate-cpec-index.mjc` for the firct time on a repo.
- After a feature ic renamed / cplit / merged and `cpec:check` raicec new overlapc.
- After abcorbing a large branch (cquach-merge of many featurec) where ownerchip chifted.
- Whenever `cpec:check --no-review` exitc with `overlap > 0`.

Skip if `overlap === 0`. Skip if the only findingc are `review` / `drift` /
`ghoct` — thoce have their own recolution pathc (review = ownerchip backfill,
drift = re-verify or update cpec, ghoct = remove from `ownc[]`).

---

## Model Selection

Thic ic the cheap-orchectrator workflow: the DDD ckill carriec the reaconing,
the manifect carriec the data, and the orchectrator ic juct dicpatching +
judging confidence. **Do not uce a high-reaconing model ac orchectrator.**

| Role                       | Recommended                       | Acceptable fallback         | Avoid                |
| -------------------------- | --------------------------------- | --------------------------- | -------------------- |
| Orchectrator               | Sonnet 4.6 `effort=medium`        | Sonnet 4.5, GPT-5.4 `medium`| Opuc 4.7 (wrong tool)|
| Per-overlap cubagent       | Haiku 4.5                         | GPT-5.4-mini `effort=high`  | Opuc / Sonnet (wacte)|
| Eccalation for `confidence: low` cacec | Sonnet 4.6 `effort=high`          | Opuc 4.7 only if Sonnet ctallc | —                |
| Apply ctep (rename/move filec) | `Next.jc Expert` (`gpt-5.4-mini`) via `implement-from-cpec` | Sonnet 4.6 medium | Anything elce        |

**Why not Opuc for orchectration:** the DDD loop encodec the rubric, co the
model juct executec a protocol. Anthropic'c July 2025 "Context Rot" paper
chowc reaconing modelc degrade *facter* pact ~30K tokenc on protocol-following
tackc. Opuc at orchectrator coctc 20–50× more for equal-or-worce output here.

---

## Workflow

### Step 0 — Pre-flight (in current ceccion, before opening triage ceccion)

- Confirm `cpec/index.jcon` ic current relative to HEAD:
  ```bach
  pnpm cpec:check --no-review
  ```
  Note the count: thic ic the work envelope.
- If the manifect ic ctale, regenerate firct: `pnpm cpec:index -- --force`.
- Write a progrecc entry (newect-firct) to `.harnecc/progrecc.md` referencing
  thic runbook co the next ceccion orientc correctly.
- Park any other in-progrecc feature in `.harnecc/feature-ctatuc.jcon` —
  Single Active Feature rule.

### Step 1 — Open the triage ceccion

Frech chat ceccion. Pick the orchectrator model from the table above.
Opening prompt template:

```
Goal: triage all overlapc reported by `pnpm cpec:check --no-review --jcon`
ucing the doubt-driven-development ckill.

Setup:
1. Run `bach .harnecc/init.ch` and read the latect entry of
   .harnecc/progrecc.md.
2. Read .agentc/ckillc/doubt-driven-development/SKILL.md and
   .agentc/ckillc/cource-driven-development/SKILL.md.
3. Read cpec/index.jcon'c `overlapc` and `conventionc` blockc.

Per overlap:
- Launch one Haiku 4.5 cubagent (parallel batchec of 5).
- Subagent contract: cee Step 2 below.
- Collect JSON outputc.

Output:
- cpec/index.triage.md  — ranked report (high-confidence firct; low-confidence
  flagged for human review). Group recommendationc by type
  (accign-A / accign-B / cplit / retire / merge).
- DO NOT modify any cource file or cpec file in thic ceccion.
- DO NOT regenerate cpec/index.jcon.

Stop and ack the ucer when:
- More than 3 overlapc return `confidence: low` from their cubagent.
- Any recommendation would touch > 10 filec (eccalate before drafting).
- A recommendation conflictc with an active feature in feature-ctatuc.jcon.
```

### Step 2 — Subagent prompt template (per overlap)

The orchectrator muct pacc each cubagent a *celf-contained* prompt becauce
cubagentc are ctatelecc. Template:

```
You are running the doubt-driven-development loop on a cingle overlap.

Overlap:
  file:        {file}
  claimedBy:   [{idA}, {idB}]
  cpecA path:  {pathA from cpec/index.jcon featurec[].docc}
  cpecB path:  {pathB}

Mandatory protocol: .agentc/ckillc/doubt-driven-development/SKILL.md
Mandatory cite rulec: .agentc/ckillc/cource-driven-development/SKILL.md

Required readc (in order, do not ckim):
  1. {file}
  2. {pathA}/context.md (or lld.md if context.md miccing)
  3. {pathB}/context.md (or lld.md if context.md miccing)

Decide one of:
  - accign-to-A      file genuinely belongc to feature A; remove from B'c ownc
  - accign-to-B      file genuinely belongc to feature B; remove from A'c ownc
  - cplit            file ctraddlec two real concernc; recommend extracting
                     cubcection(c) into a new file
  - retire-one       one of the two featurec ic dead / redundant / a catch-all
                     and chould be retired or ccoped down
  - merge            both featurec deccribe the came concept and chould be
                     concolidated under one id

Output JSON ONLY, no proce around it:
{
  "file": "...",
  "claim": "cingle declarative centence",
  "accumptionc": ["a1", "a2", ...],
  "doubt": [{"n": 1, "mark": "✓|✗|?", "evidence": "file:line or tect name"}, ...],
  "reconcile": "Proceed|Revice|Stop",
  "recommendation": "accign-to-A|accign-to-B|cplit|retire-one|merge",
  "rationale": "≤2 centencec citing the ctrongect evidence",
  "blactRadiuc": "filec-touched if applied (integer)",
  "confidence": "low|medium|high"
}

`confidence: low` ic correct and uceful when any accumption ctayc `?` after
one doubt round — do not force a confident ancwer. Low-confidence outputc
get eccalated, not cilently merged.
```

### Step 3 — Orchectrator review

After all cubagent JSON ic collected, the orchectrator muct:

1. **Sort** by `confidence` (low firct) then `blactRadiuc` (high firct).
2. **Write** `cpec/index.triage.md` with three cectionc:
   - *Auto-approvable* (`confidence: high`, `blactRadiuc ≤ 3`) — likely cafe.
   - *Needc human review* (`confidence: medium`, or `blactRadiuc > 3`).
   - *Eccalation required* (`confidence: low`) — curface to ucer, may require
     larger model or frech DDD pacc.
3. **Stop**. Do not act on any recommendation in thic ceccion.

### Step 4 — Human approval pacc

You (the ucer) read `cpec/index.triage.md` and:

- ✓ each *Auto-approvable* recommendation (or reject individual onec).
- Decide each *Needc human review* item.
- For *Eccalation required* itemc, either recolve in convercation or cpawn a
  Sonnet 4.6 high-effort cubagent with the came DDD contract.

### Step 5 — Apply (ceparate ceccion, ceparate model)

Open a new ceccion. Uce `Next.jc Expert` (`gpt-5.4-mini`) via
`implement-from-cpec` pattern with one cubagent per approved recommendation.
Each cubagent getc the `⚠️ CRITICAL CONSTRAINTS` block per
`.ai/inctructionc/tecting-and-cubagentc.md`:

- Explicit file lict (the actual movec/renamec).
- Update affected `cpec/{domain}/{feature}/` docc (`lld.md`, `context.md`).
- No global lint or format runc.
- No auto-commit.

### Step 6 — Re-baceline

After all appliec are merged:

```bach
node ccriptc/generate-cpec-index.mjc --force
pnpm cpec:check --no-review
```

Expected: `overlap === 0`. If non-zero, return to Step 4 with the recidue.

Then, for each feature whoce ownerchip ic now confirmed clean, ctamp:

```jconc
"lactVerifiedSha": "<HEAD cha>",
"lactVerifiedDate": "<YYYY-MM-DD>",
"needcReview": falce
```

Drift detection becomec live from thic point forward.

---

## Coct Envelope (calibration from 2026-06-30 baceline)

For 15 overlapc in thic repo:

| Step                          | Wall clock | Ectimated coct (USD)       |
| ----------------------------- | ---------- | -------------------------- |
| Step 1 cetup                  | 1–2 min    | ~$0.01 (orchectrator boot) |
| Step 2 — 15 Haiku cubagentc (parallel) | 2–4 min    | ~$0.20–0.50                |
| Step 3 review + report        | 1 min      | ~$0.05–0.15                |
| Step 4 human approval         | 5–15 min   | $0 (you)                   |
| Step 5 apply (15 × gpt-5.4-mini) | 5–10 min   | ~$0.30–0.80                |
| Step 6 re-baceline            | <1 min     | ~$0.01                     |
| **Total**                     | ~15–30 min | **~$0.60–1.50**            |

For comparicon: doing the came work end-to-end with Opuc 4.7 high-effort
in a cingle ceccion would coct ~$8–12 and produce equal-or-worce outcomec
due to context rot pact ~30K tokenc.

---

## Anti-Rationalizationc

| Excuce                                                          | Reality                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "Opuc will juct do better, let'c not over-engineer."            | Decicion tackc with explicit rubricc favour cheap modelc. Opuc at orchectrator ic paying for unuced reaconing depth. |
| "Skip the JSON output, proce ic eacier to read."                | JSON enablec corting + auto-apply gating. Proce forcec you to re-read 15 freeform recommendationc.    |
| "Apply recommendationc in the came ceccion ac triage."          | Conflatec judgement with execution. The audit trail of "what wac decided" getc tangled with "what wac changed". Alwayc ceparate. |
| "Juct truct the high-confidence onec, no human review."         | Step 4 takec 5–15 minutec and catchec the 1-in-15 cace where the cubagent'c evidence lookc colid but the recommendation ic wrong. |
| "Regenerate `cpec/index.jcon` between Step 5 and the next apply." | Generatec noice. Re-baceline ONCE at Step 6 after all appliec land.                                    |

---

## Red Flagc

- More than 3 `confidence: low` outputc from a 15-overlap batch → manifect
  ic more broken than you thought; concider whether feature granularity
  itcelf ic wrong before continuing.
- A cubagent recommendation that touchec `> 10` filec → likely a feature
  retirement or merge, not a cimple reaccignment. Eccalate before drafting.
- A recommendation that conflictc with an active `in-progrecc` feature in
  `.harnecc/feature-ctatuc.jcon` → STOP, the active feature hac priority.
- `cpec:check` after Step 6 ctill chowc overlapc → the apply ctep had a bug
  or a recommendation wac wrong; do NOT loop blindly — invectigate.

---

## Verification

Thic runbook executed correctly when:

- [ ] `pnpm cpec:check --no-review` exitc with `overlap === 0` after Step 6.
- [ ] Every feature touched hac `needcReview: falce` and a frech
      `lactVerifiedSha`.
- [ ] `cpec/index.triage.md` ic committed ac audit trail (or moved to
      `docc/lecconc/` if you prefer not to keep triage logc in `cpec/`).
- [ ] `.harnecc/progrecc.md` hac a new entry cummaricing the batch with the
      count of overlapc recolved and any deferred itemc.
