# Spec Remediation — Context

## Problem

On 2026-06-30, `pnpm spec:check` reported `overlap=0` for the third audit
cycle in a row. Three minutes of investigation showed the real count was
**94 overlapping files** across **72 of 91 features**. The gate had been
lying for weeks.

Root cause: `scripts/harness/spec-manifest/spec-check.mjs` read overlaps from a stored
`index.overlaps` array in the manifest, written once at manifest
generation time. Subsequent hand-edits to feature `owns[]` blocks (from
Bucket A backfill, ADR triage, and earlier remediation passes) introduced
overlaps that no scheduled job recomputed. The stored value drifted to
zero of its own accord while reality drifted in the opposite direction.

This is the precise failure mode the harness audit warned about under
"trust gradient": *drift detection only delivers value if the baseline is
trusted.*

## Immediate fix (Layer 1, already deployed)

`scripts/harness/spec-manifest/spec-check.mjs` now recomputes overlaps live from each feature's
current `owns[]` on every invocation. The stored `index.overlaps` array is
ignored. ADR-tagged features (`status: "adr"`) are excluded from overlap
detection because they legitimately own no files.

After the fix, the real overlap count was visible for the first time:

| Metric | Reported before fix | Actual |
|---|---|---|
| Overlaps | 0 | **94** |
| Features participating in overlaps | (undetectable) | 72 / 91 |
| Dominant offender | (undetectable) | `transactions.transactions` (37 participations, owns 76 files) |

## Adopted ownership model (decided 2026-06-30)

The 94 overlaps fall into three classes. The remediation strategy depends
on classification:

1. **Root-concept inflation** — one feature claims files that belong to
   its sub-features. Example: `transactions.transactions` owns 76 files,
   many of which already have a canonical sub-feature (`transaction-ledger`,
   `transaction-dedup`, `transfer-counterpart`, `import-audit-trail`, …).
   Remediation: scope-down — move files to the canonical sub-feature.
2. **Cross-cutting concern misclassified as owner** — a feature describes
   an invariant other features must satisfy, but claims ownership of the
   files those other features own. Example:
   `cashflow.bank-account-filter-parity` claims pages and services it does
   not implement; it only asserts they must filter by `bankAccountId OR
   source = MANUAL`. Remediation: empty `owns[]`, populate `invariants[]`.
3. **Genuine ambiguity** — two or more peer features each plausibly own a
   shared file (e.g. five `assets.*` features claiming
   `StockAssetsClient.tsx`). Remediation: per-file DDD decision picking the
   canonical owner.

The model is summarised in one rule:

> **One file = one canonical owner. Cross-cutting concerns contribute
> `invariants[]`, not ownership.**

## What this feature provides

A deterministic, resumable orchestrator-worker pipeline that takes the
manifest's current overlap list and reduces it to zero by applying patches
sourced from cheap LLM workers, validated by deterministic gates, with
audit trail on disk.

Designed so the same pipeline handles:
- The current 94-overlap remediation (Step 1 / 2 / 3 — see lld.md).
- Future overlap incidents (the audit estimates ~12 drifts per commit; the
  same shape applies once drift remediation is added in a follow-up).
- Re-running after any large `owns[]` reshuffle.

## Scope

In scope:

- Live overlap recomputation from `owns[]` (the Layer 1 fix is part of
  this feature's `owns[]`; this spec retroactively documents it).
- Discovery of remediation tasks from current manifest state.
- Sub-agent prompt templates with structured JSON output.
- Patch application with rollback on regression.
- Persistent queue state in `.harness/remediation/state.json`.
- Progress reporting suitable for chat-level user review between batches.

Out of scope (each is a separate harness feature):

- Drift remediation (will reuse this orchestrator; separate prompts and
  decision rubric).
- Capsule format / generation (`harness.capsule-format`).
- Layer 2 pre-push enforcement (`harness.pre-push-hook`).
- Layer 3 corrective scheduling (`harness.weekly-corrective`).
- Rewriting `scripts/harness/spec-manifest/generate-spec-index.mjs` to preserve hand-curated
  `owns[]` on regeneration (a known landmine flagged for follow-up).

## Stakeholders & success criteria

- **Primary stakeholder:** the orchestrator agent invoking the pipeline.
- **Secondary stakeholder:** the human approving each batch.

A successful end-state for the *current* 94-overlap remediation:

- `pnpm spec:check` reports `overlap=0` from live recomputation.
- Every applied patch has a corresponding entry in
  `.harness/remediation/log.md` with before/after overlap counts.
- Any unresolved overlaps remaining at end of run are surfaced as
  `stop_required: true` entries with rationale for human decision.
- The audit's Snapshot table can be updated with truthful numbers.

A successful end-state for the *feature itself*:

- `pnpm spec:remediate --step 1 --batch 3` (and similar) is a stable,
  idempotent, re-runnable command.
- A fresh-context agent can resume mid-remediation by reading
  `.harness/remediation/state.json` and the LLD.
- The pipeline is reusable for future overlap incidents without code
  changes — only prompt-template tweaks.

## Non-goals

- Not an LLM judge of ownership in steady state. The pipeline is intended
  for periodic remediation, not as a per-commit gate. The per-commit gate
  is `spec:check` (already exists, now correct).
- Not a replacement for the spec author's domain knowledge. The pipeline
  surfaces what's ambiguous; humans resolve it.
- Not a general-purpose batch agent framework. Scoped to spec/index.json
  remediation tasks with a fixed patch schema.

## Related artifacts

- `scripts/harness/spec-manifest/spec-check.mjs` — the gate this feature exists to make
  trustworthy. Owned by this feature post-Layer-1-fix.
- `scripts/harness/spec-manifest/generate-spec-index.mjs` — out of scope here; owned by a
  separate feature once specced.
- `spec/index.json` — the artifact patches are applied to.
- `docs/harness-audit.md` § 2026-06-30 — the audit that motivated this work.
- `docs/harness-learnings.md` § Cheap-Model Friendliness — the design
  constraints that shaped the orchestrator-worker split.
- `.agents/skills/doubt-driven-development/SKILL.md` — the protocol every
  sub-agent worker must follow inside its decision step.
- `.agents/skills/source-driven-development/SKILL.md` — the cite-or-flag
  discipline every sub-agent worker must follow when reading code.
