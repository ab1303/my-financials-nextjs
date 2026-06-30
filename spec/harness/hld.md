# Harness — High Level Design

> The operating environment for AI agents working in this repo.
> *What good looks like* lives in `docs/harness-learnings.md`.
> *Point-in-time findings* live in `docs/harness-audit.md`.
> *This file* defines the harness as a first-class **domain** under `spec/`,
> so its own infrastructure participates in the same gates (`spec:check`,
> `owns[]`, drift detection) that govern product code.

## Why the harness is a `spec/` domain

The audit's one-sentence verdict for 2026-06-30 is:

> *"You have a harness; you need to make its outputs load-bearing."*

The simplest way to make harness outputs load-bearing is to put the
infrastructure that produces them inside the same spec-tracked envelope as
product features. If `scripts/spec-check.mjs` drifts from its spec, the same
gate catches it. If a harness feature's `owns[]` overlaps with a product
feature, the same overlap detector flags it.

Eat your own dog food. No exemptions for the meta-layer.

## What lives in `spec/harness/`

| Concern | Lives in |
|---|---|
| **Framework + principles** (timeless, e.g. 5-subsystem model, HumanLayer practices) | `docs/harness-learnings.md` |
| **Point-in-time findings** (ratings, deltas) | `docs/harness-audit.md` |
| **Operational state** (progress log, feature status) | `.harness/` |
| **Universal rules** (always-loaded by agents) | `AGENTS.md`, `.ai/instructions/*`, `.github/instructions/*` |
| **Skills** (invocable workflows) | `.agents/skills/*/SKILL.md` |
| **Harness *features*** (concrete infrastructure with a contract) | `spec/harness/<feature>/` ← this directory |

The boundary: if it's **prose about how the harness *should* work** → `docs/` or
`.ai/instructions/`. If it's **a script, schema, or state file with a tested
contract** → spec it under `spec/harness/<feature>/`.

## Domain ownership (high-level)

Harness features collectively own:

- `scripts/spec-*.mjs` — manifest generation, checking, remediation
- `scripts/generate-spec-index.mjs` (the manifest generator)
- `.harness/feature-status.json`, `.harness/init.sh`, `.harness/clean-state-checklist.md`
- `.harness/remediation/*` (state for the remediation workstream)

Per-file authoritative ownership is assigned to individual harness features
under their own `lld.md`. Per the adopted ownership model (2026-06-30):

> One file = one canonical owner. Cross-cutting concerns contribute
> `invariants[]`, not ownership.

That rule applies to harness features as strictly as to product features.

## Catalogue of harness features

| Feature | Status | Spec | Purpose |
|---|---|---|---|
| `harness.spec-remediation` | `in-progress` | `spec/harness/spec-remediation/` | Deterministic orchestrator-worker pipeline for remediating `spec:check` findings (overlaps now; drift later) using cheap LLM workers within a scripted loop. |

**Planned (not yet specced — on the audit priority queue):**

- `harness.capsule-format` — ≤800-token `reference.md` per high-traffic feature (audit P-Q #6).
- `harness.pre-push-hook` — local Layer 2 enforcement running `pnpm spec:check:strict` (audit P-Q #4).
- `harness.weekly-corrective` — scheduled Layer 3 job opening drift triage issues (audit P-Q #10).
- `harness.phase-encoding` — populate `phase` per feature (currently all `unknown`) (audit P-Q #9).

Each becomes a separate `spec/harness/<feature>/` slice when picked up.

## Cross-cutting invariants (apply to every harness feature)

These belong on every harness feature's `invariants[]` list:

1. **The harness must not bypass its own gates.** Harness scripts that edit
   `spec/index.json` (e.g. apply-patch.mjs) must run `spec:check` after each
   edit and roll back any change that introduces a finding.
2. **Tier 3 operations require user confirmation.** Per `AGENTS.md` —
   never auto-`git push`, never `prisma db push`, etc., even from a harness
   script.
3. **Subagent invocations follow the `⚠️ CRITICAL CONSTRAINTS` contract.**
   Read-only by default; allowed reads enumerated; output schema declared.
4. **Cheap-model friendliness.** Every harness feature designed so its
   irreducible LLM step fits within Haiku-class context + reasoning budget
   (per `docs/harness-learnings.md` § Cheap-Model Friendliness).

## Out of scope for `spec/harness/`

- Product features (live in their existing domain folders).
- Pure documentation (lives in `docs/`).
- Skill definitions (live in `.agents/skills/`).
- IDE / editor configuration (`.vscode/`, `.cursor/`, etc.).
