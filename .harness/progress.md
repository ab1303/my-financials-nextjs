# Harness Progress Log

Each entry is written at the end of a session or after crossing the 50% context utilization threshold.
Agents: read the most recent entry at session start before doing anything else.

## 2026-06-30 — Empty-owns backfill P0 + P3 partial (39 features applied)

**Done this session:**

- **P0 Discovery** — classified all 72 empty-owns features into buckets via `scripts/classify-empty-owns.mjs` (idempotent, re-runnable). Output: `spec/index.backfill-plan.md`. Final bucketing after 2 regex iterations + 9 manual spot-checks:
  - **A** (live, LLD lists files): 49
  - **B** (live, undocumented): 21
  - **C** (planned): 0 — phase skipped
  - **D** (dead/migration stub): 0 — phase skipped (only stub was `user-profile`, retired previous session)
  - **E-adr** (architectural standard): 2
- **P3 Bucket A mechanical extraction** — built `scripts/extract-owns-bucket-a.mjs` with slug-aware bare-filename resolver. Extracted owns for 39/49 features (HIGH 17 + MEDIUM 22).
- **P3.5 E-adr marking** — applied `ownsConfidence: "n/a-adr"` to `architecture.calendar-attribution` and `architecture.category-url-filtering`. Extended `scripts/generate-spec-index.mjs` enum with `"n/a-adr"` and `"n/a-planned"`.
- `pnpm spec:check --no-review --json` reports **0 drift, 0 overlap, 0 review, 0 ghost, 0 shaMissing**.
- `withOwnsMatches: 19 → 60 / 91` (66% coverage).

**Current blockers:**

- 10 Bucket A LOW-confidence features have LLDs citing speculative/stale paths (e.g. `src/app/(banking)/bank-account-management/page.tsx` — folder does not exist). Mechanical extraction cannot recover them; need DDD sub-agent batch with grep-based discovery. Affected: ai-features.finance-chat, architecture.{e2e-testing, embedding-models, preferred-currency}, banking.{bank-account-management, bank-institution-ui, brokerage-hybrid, business-institutions}, cashflow.multi-account-transfer-integrity.harden-import-wizard, csv-import.batch-re-matching.
- 21 Bucket B features (mostly cashflow + transactions) have short LLDs naming only service methods — need same DDD treatment.
- `architecture.schema-naming` is in Bucket B but is likely a 3rd E-adr — re-review during DDD batch.

**Next-session entry point:**

- Read `spec/index.backfill-plan.md` Executive Summary + Bucket B/LOW lists.
- Launch DDD sub-agent batch (claude-haiku-4.5) for the 31 remaining features (10 LOW + 21 B).

---

## 2026-06-30 — Spec triage apply + manifest cleanup

**Done this session:**

- Applied the 15 overlap triage decisions in `spec/index.json`.
- Retired the root `user-profile` stub entry, reassigned the specific transaction/csv/category-rule/reimbursement/ledger claims, and cleared the stale verification stamps that Windows `spec:check` could not validate.
- `pnpm spec:check --no-review --json` now reports **0 drift, 0 overlap, 0 review, 0 ghost, 0 shaMissing**.

**Current blockers:**

- None.

---

## 2026-06-30 — Spec harness ↔ code manifest + cite/doubt skills (fix-linting branch)

**Done this session:**

- Authored audit findings on `spec/` drift, boundary overlap, indexing, and pre-vs-post-build granularity. Reference: `docs/harness-audit.md` (existing) + this session's analysis.
- `spec/index.json` (DRAFT, schema 0.1.0, 92 features) — machine-readable ownership manifest with `owns`, `ownsConfidence`, `needsReview`, `lastVerifiedSha`, `invariants`, and precomputed `overlaps`. Generator: `scripts/generate-spec-index.mjs` (idempotent, requires `--force` to overwrite).
- `scripts/spec-check.mjs` — deterministic Tier 1 drift + overlap + ghost + sha-missing detector. Wired into `package.json` as `pnpm spec:index`, `pnpm spec:check`, `pnpm spec:check:strict`.
- `.agents/skills/source-driven-development/SKILL.md` v1.0 — cite-or-flag gate for framework APIs. Pinned to `upstreamSha: aba7c4e9695c363e65cb59effe926c7f1d1abe3d` (addyosmani/agent-skills). Quarterly review cadence.
- `.agents/skills/doubt-driven-development/SKILL.md` v1.0 — CLAIM→EXTRACT→DOUBT→RECONCILE→STOP loop. Same upstream pin.
- `AGENTS.md` — added one-liner on `spec/index.json` + 2-skill callout under Subagents.
- `docs/context-engineering.md` — added `spec/index.json` row in Loading Mechanism Map and 2 new skills in Skill table.
- `docs/spec-triage-runbook.md` — operator runbook for delegating the overlap triage to a cheap model (this work's natural next step).
- First real `pnpm spec:check --no-review` run: **15 overlap findings, 0 drift, 0 ghost** (drift will surface as features get stamped with `lastVerifiedSha`).

**Not yet done:**

- Triage the 15 overlaps. `transactions.transactions` is the chief offender (claims 89 files, conflicts with 6 other specs). Procedure: `docs/spec-triage-runbook.md`.
- Per-feature ownership backfill — stamp `lastVerifiedSha` + `lastVerifiedDate` on each `needsReview: true` feature so drift detection becomes meaningful.
- Capsule generation — for `phase: "post-build"` features, distil `lld.md` → `reference.md` (≤800 tokens). Switch auto-loading from `lld.md` to `reference.md`.
- CI wire-up — add `pnpm spec:check:strict` to the GitHub Actions workflow alongside lint/type-check.

**Current blockers:**

- None.

**⚠️ Two parallel workstreams — pick ONE per session (Single Active Feature rule):**

1. **Spec triage / harness completion** (this entry) — branch-agnostic, low code risk, high harness value.
2. **Lint reduction** (next entry below, still ~336 warnings) — must finish before merging `fix-linting`.

Do NOT interleave. The active feature in `.harness/feature-status.json` (`category-groups`) is independent of both and should not be touched in either of these sessions.

**Next session starts at:**

- Read this entry to orient.
- If continuing **triage**: open `docs/spec-triage-runbook.md` and follow Step 1 onward. Switch model picker to Sonnet 4.6 effort=medium for the orchestrator; Haiku 4.5 for subagents.
- If resuming **lint**: open `docs/lint-loop-runbook.md` § Step 2. Switch to GPT-5.4-mini / Haiku 4.5.
- If something else entirely: respect Single Active Feature — finish the in-progress feature first or explicitly park it in `feature-status.json`.

---

## 2026-06-30 — Lint-reduction harness codified (fix-linting branch)

**Done this session:**

- Reduced lint count: 1 error + 496 warnings → 0 errors + ~336 warnings across 14 test files. Each file validated with per-file `eslint` + global `type-check`. No rule disabling, no `as any`, no config relaxing.
- Files cleaned (all under `src/__tests__/` and `e2e/fixtures/`): `auth.fixture.ts`, `income.service.test.ts`, `income.actions.integration.test.ts`, `income.service.integration.test.ts`, `brokerage.controller.test.ts`, `interest-cleansing.service.test.ts`, `AnalyticsFilters.test.tsx`, `dashboard-summary.test.ts`, `donation-link.service.test.ts`, `income-source.router.test.ts`, `useCleanseDonationState.repro.test.ts`, `brokerage.service.test.ts`, `business.service.test.ts`, `transaction-ledger.router.test.ts`.
- Codified the lint workflow as a reusable harness:
  - `.agents/skills/lint-reduction-loop/SKILL.md` — deterministic 6-step loop with hard-constraints table, anti-rationalization patterns, mermaid flow diagram.
  - `.ai/instructions/lint-strong-typing-recipes.md` — recipe library with before/after for 12 named recipes (`R-VI-MOCKED`, `R-PRISMA-MOCK`, `R-PRISMA-PAYLOAD`, `R-AUTH-MOCK-HELPER`, `R-TRPC-CALLER-CONTEXT`, `R-DECIMAL-LITERAL`, `R-MOCK-CALL-ARGS`, `R-COMPONENT-PROPS`, `R-UNKNOWN-ERROR`, `R-UNUSED-VAR`, `R-HOOK-DEPS`, `R-HOOK-RULES`).
  - `scripts/lint-evaluate.mjs` — new `--next` mode classifies each warning by recipe ID using source-line heuristics; emits gate commands. `R-UNKNOWN` forces STOP.
  - `package.json` — added `pnpm lint:next` alias.
  - `AGENTS.md` — added "Lint reduction" row in Canonical Instructions table.
  - `docs/lint-loop-runbook.md` — operator runbook for delegating the loop to a cheap model.
- Lint artifact placement codified in `AGENTS.md`: ad-hoc `eslint-*.json` artifacts banned at repo root; reports go under `reports/lint/`. `.gitignore` updated.

**Not yet done:**

- Drive remaining ~336 warnings to zero via the new loop (next session, cheap model — see `docs/lint-loop-runbook.md`).
- Optional: extend the classifier in `scripts/lint-evaluate.mjs` if the loop surfaces new `R-UNKNOWN` patterns.

**Current blockers:**

- None.

**Next session starts at:**

- Read this entry to orient.
- Switch model picker to a cheap tier (GPT-5.4-mini / Claude Haiku 4.5 / GPT-4.1-mini).
- Paste the opener from `docs/lint-loop-runbook.md` § Step 2. The agent will auto-invoke the `lint-reduction-loop` skill.
- Stop on first `R-UNKNOWN` and author the missing recipe before resuming.

---

## 2026-06-29 — Initial harness setup (fix-linting branch)

**Done this session:**

- Created `.harness/feature-status.json` with initial feature registry
- Created `.ai/instructions/compaction.md` (compaction protocol)
- Added Operation Risk Tiers to `AGENTS.md`
- Added Step 6b (phase compaction) to `implement-from-spec` SKILL
- Completed `docs/harness-audit.md` — full Context + Harness + HumanLayer evaluation

**Not yet done:**

- Remaining harness artifact TODOs from `docs/harness-audit.md`:
  - Add research phase sub-agent step (HumanLayer P4)
  - Add TODO(0-4) annotation system (HumanLayer P5)
  - Add session start/end protocol to `AGENTS.md` (Harness P4)

**Current blockers:**

- None

**Next session starts at:**

- Read `.harness/progress.md` (this entry) to orient
- Run `git log --oneline -5` to confirm current state
- Active feature: see `.harness/feature-status.json`

---

<!-- Add new entries above this line, newest first -->
