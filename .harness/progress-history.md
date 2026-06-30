# Harness Progress — Completed Session Archive

Entries moved here when no longer the active handoff. Newest first.
Read only for archaeology; do not use to orient a new session.

---

## 2026-06-30 — Harness spec-remediation workstream — BUILD READY 🛠️

**Workstream:** Phase 2 of the harness-audit priority queue, re-scoped from "Bucket B DDD backfill" (which turned out to be 18/20 already done) to **`spec/index.json` overlap remediation** after a stale-state bug in `spec:check` was found and fixed.

**State at end of session:** Spec authored. Folder convention decided AND executed — all harness scripts now live under `scripts/harness/<feature>/`; non-harness scripts grouped under `scripts/{db,mcp,diagnostics}/`. Build of orchestrator script is the next step — deferred to fresh session to preserve context budget.

## What's done

### 0. `scripts/` reorganised into purpose-grouped folders (executed end of session)

Old flat `scripts/*` (15 files) → grouped:

```
scripts/
├── harness/
│   ├── spec-manifest/      # spec-check.mjs, generate-spec-index.mjs, classify-empty-owns.mjs
│   ├── lint-reports/       # lint-evaluate.mjs
│   ├── repo-hygiene/       # check-utf8.mjs
│   └── spec-remediation/   # (folder created next session during build)
├── db/                     # prisma-safe.sh, backup_postgres.sh, migrate-bank-assets.ps1, backfill-donationpayment.sql
├── mcp/                    # mcp-setup.ts, mcp-health-check.ts, mcp-docker-run.ts
└── diagnostics/            # diagnose-csv-import.ts
```

**Deleted as completed/noise:** `scripts/extract-owns-bucket-a.mjs`, `scripts/apply-bucket-a-extraction.mjs`, `scripts/.tmp/` (one-off Bucket A migration; git history preserves).

**Fixes that landed with the move:**
- `spec-check.mjs` and `generate-spec-index.mjs` REPO_ROOT path adjusted (`..` → `../../..`) to account for new depth.
- `package.json`: 4 entries updated (`lint:evaluate`, `lint:top-warnings`, `lint:next`, `lint:evaluate:json`, `spec:index`, `spec:check`, `spec:check:strict`, `mcp:setup`, `mcp:restart`, `prisma`).
- Doc refs updated: `README.md`, `.ai/instructions/database-safety.md`, `.ai/instructions/prisma-guard-rail.md`, `.agents/skills/lint-reduction-loop/SKILL.md`, `docs/spec-triage-runbook.md`, `spec/index.triage.md`, `spec/index.backfill-plan.md`, `spec/harness/hld.md`, `spec/harness/spec-remediation/lld.md`, `spec/harness/spec-remediation/context.md`.
- `spec/harness/hld.md` § Folder convention rule #3 rewritten: harness scripts always live under `scripts/harness/<feature>/`; no "temporarily at top level" intermediate state.

Verified post-move: `pnpm spec:check` → drift=50 / overlap=94 / ghost=0 (unchanged from before reorg, as expected). `pnpm run type-check` → clean.

### 1. Phase 1 — ADR schema decision (Option 3 adopted)

Re-decided after discovering the prior session's Option 1 "lock" was tactical. Schema now: `status: 'adr'` + `ownsConfidence: 'none'` (was `ownsConfidence: 'n/a-adr'`). Applied to 3 features: `architecture.calendar-attribution`, `architecture.category-url-filtering`, `architecture.schema-naming`. Files: `spec/index.json` (conventions + 3 entries), `scripts/spec-check.mjs` (ADR-skip guard), `scripts/generate-spec-index.mjs` (enum sync), `spec/index.backfill-plan.md` (decision logged). `scripts/apply-eadr.mjs` deleted.

### 2. Layer 1 — `spec:check` overlap recompute (gate fix)

Critical finding: previous "0 overlaps" reported by `spec:check` was a lie — manifest's stored `overlaps` field was never refreshed after hand-edits introduced new overlaps. Patched `scripts/spec-check.mjs` to recompute live from `owns[]` on every run. Real count: **94 overlaps**, 72 of 91 features participate.

### 3. Adopted ownership model (state-of-the-art)

> **One file = one canonical owner. Cross-cutting concerns contribute `invariants[]`, not ownership.**

Rationale captured in `spec/harness/spec-remediation/context.md`. The 94 overlaps fall into 3 classes:
- **Root-concept inflation** (e.g. `transactions.transactions` owns 76 files, many belonging to sub-features) → Step 1 scope-down.
- **Cross-cutting misclassified as owner** (e.g. `cashflow.bank-account-filter-parity` claims pages it merely invariants) → Step 2 invariant reclassification.
- **Genuine ambiguity** (e.g. `StockAssetsClient.tsx` with 5 plausible owners) → Step 3 DDD decision.

### 4. Phase 2 reframe (the actual remaining work)

Original "21-feature Bucket B" was already 18/20 complete before today. The actual Phase 2 work is overlap remediation, executed via the orchestrator-worker pipeline specified in `spec/harness/spec-remediation/lld.md`.

### 5. New `spec/harness/` domain created and specced

- `spec/harness/hld.md` — domain definition; folder convention (`spec/harness/<feature>/ ⟷ scripts/harness/<feature>/`); catalogue of features (1 current, 4 planned from audit P-Q).
- `spec/harness/spec-remediation/context.md` — problem framing, ownership model, scope, success criteria.
- `spec/harness/spec-remediation/lld.md` — architecture, file layout, state machine, task + patch JSON schemas, script contracts, chat-level execution loop, 5 invariants, decision rubric, cheap-model-friendliness checklist, acceptance criteria.
- Registered as `harness.spec-remediation` in `spec/index.json` with `status: in-progress`, `phase: build`, `ownsConfidence: n/a-planned`, 4 invariants populated.

### 6. Pilot proved the worker prompt template works

One `claude-haiku-4.5` sub-agent given the `transactions.import-audit-trail` scope-down task produced a clean JSON patch: correctly bucketed 3 files (1 service / 2 components), every `evidence[].file:line` citation was real, DDD trace was rigorous (not performative), `confidence: high`, `stop_required: false`. Validates the template at the heart of the LLD.

## Verification evidence

- `pnpm spec:check` → drift=50 / **overlap=94 (live recompute)** / ghost=0 / sha-missing=0 / review=0.
- `node -e "require('./spec/index.json')..."` → 92 features registered; 3 ADRs tagged; `harness.spec-remediation` present with 4 invariants.
- Pilot patch (saved in chat transcript; not persisted to disk yet — first batch will).

## Next session starts here ⏭️

**Read first:**
1. `spec/harness/spec-remediation/lld.md` (authoritative design — no need to re-derive from chat history).
2. This entry.
3. `spec/harness/hld.md` § Folder convention (for `scripts/harness/<feature>/` layout).

**Then build, per LLD `## File layout` and `## Script contracts` sections:**

```
scripts/harness/spec-remediation/
├── discover.mjs          # produces .harness/remediation/step{N}-tasks.json
├── apply-patch.mjs       # applies ONE patch + spec:check + rollback
├── apply-batch.mjs       # iterates patches-batch-N/*.json
├── report.mjs            # current state + queue dashboard
├── lib/{manifest,overlaps,patch,prompts}.mjs
├── prompts/step{1,2,3}-*.md      # sub-agent templates
├── schema/{patch,task}.schema.json
└── README.md             # pointer to LLD
```

Estimated build effort: 45–60 min focused. No LLM API calls inside the scripts (pure deterministic node). Sub-agent dispatch happens at the chat layer via the `task` tool, NOT from the scripts.

**Acceptance criteria for the build** (from `lld.md` § Acceptance criteria):
- [ ] `discover.mjs --step 1` runs and produces non-empty `step1-tasks.json`.
- [ ] One end-to-end batch (discover → dispatch 3 sub-agents → apply → verify) completes with overlap strictly decreasing.
- [ ] `report.mjs` correctly shows new state.
- [ ] State file persists across session restart.
- [ ] All 5 LLD invariants hold.
- [ ] LLD updated if reality diverged during build.

**After build succeeds:**
1. Update `harness.spec-remediation` entry in `spec/index.json`: populate `owns[].services` with `scripts/harness/spec-remediation/**/*.mjs`; set `ownsConfidence: "high"`; stamp `lastVerifiedSha: <HEAD>`.
2. Commit build + manifest update (Tier 2 — ask user).
3. Run the pipeline: Step 1 discover → batch 1 dispatch → apply → report → user-approve → batch 2 → … → step 2 → step 3.

## Files modified this session (status)

- `spec/index.json` — Phase 1 ADR entries + new harness.spec-remediation registration. **Phase 1 work committed by user; harness registration may need separate commit.**
- `scripts/spec-check.mjs` — Layer 1 gate fix + ADR-skip guard + docstring. **Committed by user.**
- `scripts/generate-spec-index.mjs` — enum sync. **Committed by user.**
- `scripts/apply-eadr.mjs` — deleted. **Committed by user.**
- `spec/index.backfill-plan.md` — Option 3 decision logged. **Committed by user.**
- `spec/harness/hld.md` — created. **Spec content committed; folder convention block added after commit — may need follow-up commit.**
- `spec/harness/spec-remediation/context.md` — created. **Committed by user.**
- `spec/harness/spec-remediation/lld.md` — created, then folder-path references updated from `scripts/spec-remediation/` to `scripts/harness/spec-remediation/`. **Original committed by user; folder-path updates may need follow-up commit.**
- `.harness/progress.md` — this entry.
- `.harness/progress-history.md` — old lint entry archived.

**Uncommitted at end of session (verify with `git status`):**
- Folder-convention additions to `hld.md` and path updates in `lld.md` (minor, ~30 LOC across 2 files).
- This progress.md entry.

## Reference: top-10 overlap offenders (for triage prioritisation)

For the orchestrator script's `discover.mjs` heuristics:

| Rank | Feature | Overlap participations | Class |
|---:|---|---:|---|
| 1 | `transactions.transactions` | 37 | Root-concept (76 owned files) — Step 1 |
| 2 | `ai-features.ai-image-import` | 7 | Likely Step 3 (cross with csv-import + ai infra) |
| 3 | `cashflow.income.income-source-of-truth` | 7 | Likely canonical owner; others should yield |
| 4 | `transactions.transaction-bulk-apply` | 6 | Bulk ops touch ledger files — Step 3 |
| 5 | `assets.brokerage-cash-holdings` | 5 | Cross with other assets features — Step 3 |
| 6 | `cashflow.multi-account-transfer-integrity.fix-transfer-exclusion` | 5 | Likely Step 2 (invariant on transfer files) |
| 7 | `technical_debt.preapply-category-rules` | 5 | Likely Step 1 or 3 |
| 8 | `cashflow.interest.cleansing-debit-linking` | 5 | Likely Step 1 (sub-feature of cleansing) |
| 9 | `transactions.transaction-ledger` | 5 | Canonical for ledger; others should yield |
| 10 | `cashflow.multi-account-transfer-integrity.harden-import-wizard` | 5 | Likely Step 2 (invariant on import-wizard files) |

Full data available via: `node -e "..."` recipes in chat transcript or re-derived from `spec/index.json` directly.

**Closed:** Build executed and committed in session 2026-06-30 PM (commit a8f24ad). Pipeline run handed off to next session.

---

## 2026-06-30 — Lint + build cleanup ✅ (lint closed; test-file type errors deferred)

**Closed:** All 336 lint warnings fixed across 150 files via 4 parallel subagents. Build passes cleanly. `pnpm run lint:evaluate:json` → 0 errors / 9 intentional `as any` warnings (eslint-disable-commented, library type limitations).

**Highlights:**

- Fixed `eslint.config.mjs` to add `varsIgnorePattern/caughtErrorsIgnorePattern/destructuredArrayIgnorePattern: '^_'`.
- Fixed 13 sequential build errors introduced by subagents stripping needed `as any` casts (NewSnapshotModal, HoldingFormModal, BeneficiaryFormFields, donations/actions, CreditsDialog, relation forms, dedup.service, csv routes, TableCell, TelInput, classify/route).

**Deferred (separate workstream, not lint):**

- `pnpm run type-check` still reports test-file type errors in `src/__tests__/` and `e2e/` — patterns documented at the bottom of this entry. Treat as a fresh "test-types cleanup" workstream if/when revisited.

**Test-file type-error patterns documented for future pickup:**

- `mockResolvedValue not on 'never'` — agent changed `any` → `unknown` in mock setup; prisma mock methods on `unknown` lose `.mockResolvedValue`. Fix: `vi.mocked(prisma.model.method).mockResolvedValue(...)`.
- `find-duplicates.service.test.ts` — `findDuplicatesForClassifiedMonths` no longer accepts `prisma` param (module-level import now); remove it from test calls.
- Spread on `unknown` — replace `unknown` with `Record<string, unknown>` or specific type cast.
- Specific files with errors: `CategoryGroupsDrawer.test.tsx`, `cashflow-analytics.route.test.ts`, `charity-tax.test.ts`, `CleansingCandidatePicker.test.tsx`, `donation-zakat-core.test.ts`, `IncomeTableClient.monthHeader.test.tsx`, `interest-cleansing-phase3.test.ts`, `interest-cleansing.scoring.test.ts`, `bank-interest.getCleansingDebitCandidates.test.ts`, `find-duplicates.service.test.ts`, `SourceBadge.contrast.test.tsx`, `stock-asset.schema.test.ts`, `TableCell.amount.test.tsx`, `transfer-rule-job.test.ts`.

---

## 2026-06-30 — Spec harness 100% complete ✅

- `spec/index.json` — 91 features, 86 owns populated, `pnpm spec:check` → **0 / 0 / 0 / 0 / 0** (drift / overlap / review / ghost / shaMissing).
- `lastVerifiedSha` stamped on all 86 owned features (`c361465c`).
- `scripts/spec-check.mjs` Windows `^{commit}` bug patched — `git rev-parse --verify`.
- Confidence breakdown: high=38, medium=38, low=8, n/a-adr=3, n/a-planned=1, none=3.

---

## 2026-06-30 — Spec triage COMPLETE (86/91 owns, all 91 classified)

**Done this session (combined P4 + triage close-out):**

- **P4 Bucket B + LOW A DDD batch** — grep-based discovery for all 31 remaining empty-owns features. `withOwnsMatches: 60 → 86 / 91`.
- **Banking manifest resolved** — `Business` model with `BusinessEnumType` (BANK/BROKERAGE/PHILANTHROPY) is the unified entity. Populated `banking.bank-institution-ui` (bank.ts router/service/controller), `banking.brokerage-hybrid` (brokerage router/service/controller + settings pages), `banking.business-institutions` (business.schema.ts anchor).
- **LOW-confidence triage** — expanded 5 low-confidence features to full owns; fixed `AnalyticsDrillDownDrawer` overlap between `cashflow.analytics-drill-down` and `cashflow.categories.drill-down`; fixed `transaction-clearing.ts` duplicate between `transactions.transaction-clearing` and `transactions.import-audit-trail`.
- **`architecture.schema-naming`** confirmed as 3rd E-adr → `ownsConfidence: "n/a-adr"`.
- **`csv-import.batch-re-matching`** marked `ownsConfidence: "n/a-planned"` — `BatchReMatchJob` never added to schema, `CategoryRule` + `preapply` workflow made it redundant.
- `pnpm spec:check --json` → **0 drift, 0 overlap, 0 review, 0 ghost, 0 shaMissing**.

---

## 2026-06-30 — Empty-owns backfill P4 Bucket B + LOW Bucket A (31 features)

- **P4 DDD batch** — 31 features, grep-based discovery. `withOwnsMatches: 60 → 84 / 91`.
- `architecture.schema-naming` confirmed E-adr. 4 unbuilt features left empty.
- `pnpm spec:check --no-review --json` → **0 / 0 / 0 / 0**.

---

## 2026-06-30 — Banking manifest + LOW-confidence triage (86/91)

- `Business` + `BusinessEnumType` clarified. Banking features populated.
- 5 LOW-confidence features expanded. Overlaps fixed.
- `withOwnsMatches: 84 → 86 / 91`.

---

## 2026-06-30 — Empty-owns backfill P0 + P3 partial (39 features applied)

- **P0 Discovery** — 72 features bucketed (A=49, B=21, E-adr=2).
- **P3 Bucket A** — 39/49 features extracted mechanically. `withOwnsMatches: 19 → 60 / 91`.
- **P3.5 E-adr** — `calendar-attribution` and `category-url-filtering` marked `n/a-adr`.

---

## 2026-06-30 — Spec triage apply + manifest cleanup

- Applied 15 overlap triage decisions. Retired root `user-profile` stub.
- `pnpm spec:check --no-review --json` → **0 drift, 0 overlap, 0 ghost**.

---

## 2026-06-30 — Spec harness ↔ code manifest + cite/doubt skills (fix-linting branch)

- `spec/index.json` (91 features), `scripts/spec-check.mjs`, `pnpm spec:check/spec:check:strict`.
- `source-driven-development` + `doubt-driven-development` skills authored.
- First spec:check run: 15 overlaps, 0 drift, 0 ghost.

---

## 2026-06-29 — Initial harness setup (fix-linting branch)

- `.harness/feature-status.json`, `.ai/instructions/compaction.md`, Operation Risk Tiers in `AGENTS.md`.
- `docs/harness-audit.md` — full Context + Harness + HumanLayer evaluation.
