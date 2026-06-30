# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-06-30 — Harness spec-remediation workstream — PIPELINE READY 🚀

**Workstream:** `spec/index.json` overlap remediation. The build is complete; the next session runs the actual pipeline (dispatch sub-agents → apply patches → drive overlap count 94 → 0).

**State at end of session:** Orchestrator + libs + prompts + schemas built, committed (a8f24ad), and registered in `spec/index.json` (a8f24ad + follow-up). All 12 build/registration verification checks PASS. The four pipeline checks remain — they require sub-agent dispatch and can only be done one batch at a time with human approval between batches.

## What's done this session

### 1. Built `scripts/harness/spec-remediation/` (13 files)

Per `spec/harness/spec-remediation/lld.md` § File layout. No deviation from spec.

```
scripts/harness/spec-remediation/
├── README.md                         # pointer to LLD
├── discover.mjs                      # build step{N}-tasks.json from manifest
├── apply-patch.mjs                   # apply ONE patch + rollback on overlap regression
├── apply-batch.mjs                   # iterate patches-batch-N/*.json
├── report.mjs                        # dashboard: overlaps + queues + log tail
├── lib/
│   ├── manifest.mjs                  # atomic read/write of spec/index.json
│   ├── overlaps.mjs                  # live overlap recompute (mirror of spec-check.mjs)
│   ├── patch.mjs                     # hand-rolled validator + 5 ops + idempotency
│   └── prompts.mjs                   # placeholder substitution + CRITICAL CONSTRAINTS gate
├── prompts/
│   ├── step1-scope-down.md           # scope-down template (haiku-friendly)
│   ├── step2-invariant-classify.md   # invariant reclassification template
│   └── step3-overlap-decide.md       # boundary-decision template
└── schema/
    ├── task.schema.json              # step{N}-tasks.json grammar (doc + future-proof)
    └── patch.schema.json             # sub-agent output grammar
```

Plus `.harness/remediation/` bootstrap: `state.json`, empty `log.md`, and discover-generated `step{1,2,3}-tasks.json` (13/3/94 tasks).

### 2. Manifest registration

`spec/index.json::harness.spec-remediation` updated:
- `owns.services`: 13 files (8 .mjs + 3 prompt .md + 2 schema .json)
- `ownsConfidence`: `n/a-planned` → `high`
- `lastVerifiedSha`: `null` → `95843a0` (HEAD at time of verification; post-commit drift on a8f24ad is expected and will be re-stamped after the pipeline completes)
- Does NOT participate in any overlap (verified via `computeOverlaps`)

### 3. Verification gate — 12/16 PASS, 4 pipeline checks deferred

See `.harness/feature-status.json` for full `verification[]` + `evidence[]`. Highlights:

| Check | Status | Evidence |
|---|---|---|
| build-layout matches LLD § File layout | ✓ | git ls-tree |
| discover --step {1,2,3} | ✓ | wrote 13/3/94 tasks |
| apply-patch rollback on overlap regression | ✓ | synth patch → 94→94 → exit 1 |
| apply-patch happy path (dry-run) | ✓ | step3-t001 → 94→93, disk clean |
| report.mjs dashboard | ✓ | shows 92 features, 94 overlaps, queues, top participants |
| resumability (refuse without --force) | ✓ | exit 2 on re-run |
| no git/pnpm/prisma calls in scripts | ✓ | grep clean |
| manifest registration | ✓ | spec:check unchanged |
| pnpm spec:check | ✓ | drift=50 overlap=94 ghost=0 (overlap unchanged) |
| pnpm run type-check | ✓ | exit 0 |
| **pipeline batch-1** | ⬜ | next session |
| **pipeline step-{1,2,3} complete** | ⬜ | future sessions |

### 4. Hard constraints honoured

- Zero git operations from scripts (commits and pushes are user-only per AGENTS).
- Zero pnpm/shell dependencies inside the orchestrator (pure node).
- Atomic manifest writes (write-temp + rename); idempotent ops; rollback guard.
- LLD invariants #1–6 all hold under targeted verification.

## Next session starts here ⏭️

**Read first:**
1. `spec/harness/spec-remediation/lld.md` § **Chat-level execution loop** (the procedure to follow).
2. This entry.
3. Optional: `.harness/feature-status.json::harness.spec-remediation` for the open verification items.

**Then run, in order:**

```bash
# 1. Orient — confirms 94 overlaps and 13/3/94 pending tasks survived the session.
node scripts/harness/spec-remediation/report.mjs

# 2. Dispatch batch 1: pick K=3 (default) step-1 tasks (step1-t001..t003).
#    Use the `task` tool with agent_type: explore (read-only), model: claude-haiku-4.5.
#    Prompt: render scripts/harness/spec-remediation/prompts/step1-scope-down.md
#    with placeholders from each task. Sub-agent returns ONE JSON patch.
#    Save raw output to .harness/remediation/patches-batch-1/task-{id}.json.

# 3. Apply the batch.
node scripts/harness/spec-remediation/apply-batch.mjs --batch 1

# 4. Verify.
node scripts/harness/spec-remediation/report.mjs

# 5. Ask user to approve next batch OR pause for any stop_required escalation.
```

**Key dispatch details for the orchestrator agent (you, next session):**
- Tools allowed for sub-agent: `view`, `grep`, `glob` only. NOT `edit`, `create`, `powershell`. Enforce in the `task` invocation.
- Model: `claude-haiku-4.5` for steps 1 & 2; `claude-sonnet-4.5` for step 3 (per LLD § Chat-level execution loop).
- Render `ALLOWED_READS` whitelist = `task.files` + `task.docs.lld` paths + the subject/target/claimant LLD paths. Templates throw if you forget a placeholder — that's intentional, not a bug.
- After every successful batch: ask user before starting the next batch (LLD § Chat-level execution loop step 2g).

**On stop_required:** read the patch's `rationale` + `ddd_trace`, surface the ambiguity via `ask_user`, then write a human-authored patch over the sub-agent's JSON and re-run `apply-batch.mjs`. Do NOT auto-resolve — that's the entire reason `stop_required` exists.

**On completion of all 3 steps:**
1. `node scripts/harness/spec-remediation/report.mjs --final` → produces commit-message-worthy summary.
2. Re-verify `harness.spec-remediation` in `spec/index.json`: bump `lastVerifiedSha` to the latest HEAD that includes all manifest mutations.
3. Mark the 4 pending `verification[]` items in `feature-status.json` as `passing: true` with evidence.
4. Move this progress entry to `progress-history.md`.
5. Ask user to commit final state (Tier 2).

## Files committed this session

- `a8f24ad feat(harness): build spec-remediation orchestrator scripts` — full build + manifest registration + `.gitignore` + bootstrap state.

## Files modified this session (uncommitted at session end)

- `.harness/progress.md` — this entry.
- `.harness/progress-history.md` — archived prior "BUILD READY" entry with a "Closed" suffix.
- `.harness/feature-status.json` — added `harness.spec-remediation` with 16 verification items (12 passing, 4 pipeline-pending) + 12 evidence rows.

## Reference: top-10 overlap offenders (unchanged from prior session)

For batch prioritisation. Live source: `node scripts/harness/spec-remediation/report.mjs`.

| Rank | Feature | Participations | Likely step |
|---:|---|---:|---|
| 1 | `transactions.transactions` | 37 | Step 1 (root concept) |
| 2 | `ai-features.ai-image-import` | 7 | Step 3 |
| 3 | `cashflow.income.income-source-of-truth` | 7 | Step 3 (canonical owner) |
| 4 | `transactions.transaction-bulk-apply` | 6 | Step 3 |
| 5 | `assets.brokerage-cash-holdings` | 5 | Step 3 |
| 6 | `cashflow.multi-account-transfer-integrity.fix-transfer-exclusion` | 5 | Step 2 |
| 7 | `technical_debt.preapply-category-rules` | 5 | Step 1 or 3 |
| 8 | `cashflow.interest.cleansing-debit-linking` | 5 | Step 1 |
| 9 | `transactions.transaction-ledger` | 5 | Step 3 (canonical) |
| 10 | `cashflow.multi-account-transfer-integrity.harden-import-wizard` | 5 | Step 2 |
