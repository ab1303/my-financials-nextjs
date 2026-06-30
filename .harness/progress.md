# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-06-30 — Spec manifest overlap remediation — IN PROGRESS 🔧

**Workstream:** Phase 2 of the harness-audit priority queue (Bucket B DDD backfill + downstream).
**State:** Original "21-feature Bucket B" turned out to be already 18/20 complete. Real work is `spec/index.json` overlap remediation: **94 live overlaps surfaced** after fixing a stale-state bug in `spec:check`. Layers 1 (gate fix) and Phase 1 (ADR schema) done. Layer 2 (overlap reclassification via invariants[]) is the active task.

**Done this session:**

- **Phase 1 — ADR schema decision (Option 3 adopted):** Re-decided after discovering the prior session's Option 1 "lock" was tactical. Schema now: `status: 'adr'` + `ownsConfidence: 'none'` (was: `ownsConfidence: 'n/a-adr'`). Applied to 3 features: `architecture.calendar-attribution`, `architecture.category-url-filtering`, `architecture.schema-naming`. Files: `spec/index.json` (conventions + 3 entries), `scripts/spec-check.mjs` (ADR-skip guard), `scripts/generate-spec-index.mjs` (enum sync), `spec/index.backfill-plan.md` (decision logged). `scripts/apply-eadr.mjs` deleted (superseded one-off).
- **Layer 1 — `spec:check` overlap recompute (gate fix):** Replaced stale `index.overlaps` array read with live recomputation from `owns[]`. Critical finding: previous "0 overlaps" reported by `spec:check` was a lie — manifest's stored `overlaps` field was never refreshed after hand-edits introduced new overlaps. Patched `scripts/spec-check.mjs` lines 148-167.

**Verification evidence:**

- `pnpm spec:check` → drift=50 / **overlap=94** (was reported as 0) / ghost=0 / sha-missing=0 / review=0.
- `node -e "require('./spec/index.json')..."` → 3 ADR features tagged correctly, 0 stale `n/a-adr` references, conventions enums consistent.
- 18/20 original Bucket B features at `ownsConfidence: high` (Phase 2 original scope effectively complete).

**Key insight (re-frames Phase 2):** 72 of 91 features participate in overlaps. Dominant offender: `transactions.transactions` (37 overlap participations — owns 76 files, audit priority #7 flagged this as deferred). Likely 30+ overlaps dissolve mechanically just by scoping it down. Invariant-only features (e.g. `cashflow.bank-account-filter-parity`, `cashflow.multi-account-transfer-integrity.*`) have been claiming ownership of files they merely contribute invariants to — a model-level error.

**Adopted ownership model (state-of-the-art, decided 2026-06-30):**

1. **One owner per file.** The owner is the spec that defines the file's contract.
2. **Cross-cutting concerns own no files.** They contribute `invariants[]` text to the canonical owner's spec. The `invariants: []` field already exists on every feature — it's been underused.
3. **`spec:check` overlap detection** is now live-computed; it surfaces ownership conflicts, not import/usage relationships.
4. **`touches[]` field** (for traceability of cross-cutting concerns) deferred — invariant text is grep-able.

**Remaining work (next session — Layer 2 + Step 1):**

### Step 1 — Scope down `transactions.transactions` (highest leverage, ~30+ overlaps dissolve)
Audit priority #7 finally getting attention. Currently owns 76 files; should be a thin root concept owning maybe 10. Files belong to existing sub-features (`transaction-ledger`, `transaction-dedup`, `transfer-counterpart`, etc.).

### Step 2 — Reclassify obvious invariant-only features
Move from `owns: [...]` to `owns: []` + populated `invariants[]`:
- `cashflow.bank-account-filter-parity`
- `cashflow.multi-account-transfer-integrity.add-filtration-parity`
- `cashflow.multi-account-transfer-integrity.handle-orphans`
- Possibly: `architecture.site-audit`

### Step 3 — DDD triage on remaining ~40 true overlaps
Genuine boundary decisions among 2-5 claimant features per overlapping file. Per-overlap DDD pass. Examples: `StockAssetsClient.tsx` (5 assets-feature claimants), `csv-confirm.service.ts` (6 claimants).

### Final cleanup (after Steps 1-3)
- Re-run `pnpm spec:check` — expect overlap=0 from real signal.
- Update audit Snapshot table to reflect the actual baseline.
- Then back to original Phase 2 holdouts: 2 features at `medium` confidence (`cashflow.bank-account-filter-parity` covered above; `transactions.transfer-reconciliation`) + 5 at `low/none` (`architecture.category-filters`, `transactions.reimbursements`, `transactions.transaction-clearing`, `user-profile.user-profile`, `ai-features.finance-chat`).

**Sub-agent delegation plan for Steps 1-3:** See the orchestrator's analysis in this session's chat log — three-step pipeline with cheap sub-agents emitting JSON patches, orchestrator applying serially.

**Files modified this session (uncommitted):**

- `spec/index.json` — conventions + 3 ADR entries
- `scripts/spec-check.mjs` — overlap recompute + ADR guard + docstring
- `scripts/generate-spec-index.mjs` — enum sync
- `scripts/apply-eadr.mjs` — **deleted**
- `spec/index.backfill-plan.md` — Option 3 decision logged
- `.harness/progress.md` — this entry
- `.harness/progress-history.md` — old lint entry archived

**Next session starts at:** Read this entry, then either (a) execute the sub-agent delegation plan for Step 1, or (b) commit current work first.
