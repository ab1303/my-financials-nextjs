# Manifest Preservation — Context

## Problem

`scripts/harness/spec-manifest/generate-spec-index.mjs` was designed for
**initial bootstrap** of `spec/index.json` (the header comment says so:
*"Humans (and agents) backfill `owns` afterwards"*). It has never been
updated to handle the steady-state case of regeneration *after*
hand-curation.

Running `pnpm spec:index` today destroys:

| Field | What is lost |
|---|---|
| `owns[]` | All 94 boundary remediation decisions (re-inferred from heuristics) |
| `invariants[]` | All cross-cutting concerns moved here in Step 2 of remediation |
| `lastVerifiedSha` | The drift detection baseline (86/91 features stamped) |
| `lastVerifiedDate` | Verification history |
| `needsReview` | Reverts to `true` everywhere — wipes triage state |
| `ownsConfidence` | Manual upgrades lost; recomputed from heuristic match count |

`consumes[]` is the **only** hand-curated field currently preserved
(added by `harness.consumes-derivation` Stream A on 2026-06-30).

This is a known landmine flagged for follow-up in
`spec/harness/spec-remediation/context.md` § "Out of scope". Until
this feature ships, `pnpm spec:index` cannot be safely run.

## Why it matters now

The harness audit priority queue includes:

- #3 Re-baseline manifest after Bucket B backfill
- #5 Drift triage runbook (re-stamps `lastVerifiedSha`)
- #7 Scope-down `transactions.transactions`
- #2 Bucket B DDD backfill

Every one of those items needs regeneration to be safe. Without this
feature, each becomes "do it manually forever, never regenerate."

## Design principle

The cleanest mental model:

- **Existing features** (entry present in previous manifest) →
  **preserve all hand-curated fields**. Heuristics are ignored.
- **New features** (spec folder exists, no previous entry) → use
  heuristics for `owns[]`; other fields get conservative defaults
  (`needsReview: true`, `lastVerifiedSha: null`, etc.).
- **Force bootstrap** (`--reset` flag) → ignore previous manifest
  entirely; behave like first-ever run. Used only when intentionally
  rebuilding from scratch.

No "merge" semantics. No partial preservation. A field is either
preserved or it isn't — and the decision is per-feature, based purely
on presence in the previous manifest.

## Scope

In scope:

- Extend `generate-spec-index.mjs` to preserve the six hand-curated
  fields listed above for existing features.
- Add `--reset` flag for explicit force-bootstrap.
- Verify end-to-end: hand-edit a feature → regenerate → confirm
  preservation → diff shows zero change.

Out of scope:

- Schema changes to `spec/index.json` (no new fields).
- Changes to `spec:check` or any other harness script.
- Changes to heuristic `inferOwns()` logic.
- Migration tooling for upgrading old manifest formats.

## Success criteria

- Running `pnpm spec:index` on the current manifest produces **zero
  meaningful diff** (only `generatedAt` and similar timestamp fields
  may change).
- Hand-edits made between runs survive.
- `pnpm spec:index --reset` reverts to the current (bootstrap)
  behaviour for the explicit case where someone wants it.
- A new spec folder added under `spec/<domain>/<feature>/` between
  runs is picked up with heuristic `owns[]` inference (no regression
  on the initial-bootstrap use case).
- `pnpm spec:check` totals unchanged after a regeneration.

## Wall-clock target

**~20-25 minutes.** One file modified, ~30 lines added. Verification
is a small shell loop (snapshot → edit → regenerate → diff → restore).

## Related artifacts

- `scripts/harness/spec-manifest/generate-spec-index.mjs` — owner
  changes hands to this feature post-implementation; previously
  co-owned with `harness.consumes-derivation` (Stream A).
- `spec/harness/spec-remediation/context.md` § "Out of scope" — where
  this landmine was first flagged.
- `spec/harness/consumes-derivation/lld.md` § Stream A — the
  preservation pattern this feature generalises.
- `docs/harness-audit.md` § Priority Queue items #3, #5, #7 — work
  this feature unblocks.
