# Consumes Derivation — Context

## Problem

The 2026-06-30 overlap remediation (`spec/harness/spec-remediation/`)
reduced 94 overlapping `owns[]` claims to a single canonical owner per
file. That achieved the boundary clarity the orchestrator needs to
dispatch parallel subagents safely. However, the cleanup collapsed
**two distinct relationships** into one:

1. **Authorship** — "I define this file's contract." (`owns[]`, now
   correctly unique per file.)
2. **Consumption** — "I import this file; if its API changes, I break."
   (Not represented anywhere in the manifest.)

When the pipeline stripped a duplicate `owns[]` claim, it preserved
authorship but **silently discarded the consumption signal**. For
example, if `transactions.transaction-ledger` legitimately imports a
shared `<Button>` owned by `shared.ui-primitives`, neither the manifest
nor any tool can now express that dependency.

## Downstream consequences

- A subagent dispatched to modify a shared component cannot query
  "who depends on me?" → no cross-feature impact analysis.
- `spec:check` cannot distinguish a real leaky-abstraction smell
  (feature B imports feature A's private internals) from legitimate
  shared use.
- `implement-from-spec` cannot generate accurate impact summaries
  before fanning out subagents.

## Source of truth

The TypeScript import graph in `src/**/*.ts{,x}` is the **canonical
record** of consumption. It was not affected by remediation — `import`
statements are unchanged. `consumes[]` is therefore a **derived
cache** of that graph, not a hand-curated field.

This is critically different from `owns[]`, which is authored by
humans/specs and validated by code. `consumes[]` can be generated
mechanically with zero LLM involvement.

## Scope

In scope:

- Add `consumes` to the manifest schema + `conventions` vocabulary.
- Deterministic derivation script (no LLM): walks owned files, parses
  imports, resolves via `tsconfig` paths, reverse-indexes via `owns[]`.
- Update `spec:check` so `consumes[]` is treated as expected-non-unique
  (never flagged as overlap).
- Secondary "leaky-abstraction" report: surface cross-feature imports
  that reach into another feature's internals rather than its public
  boundary.

Out of scope:

- Hand-curated `consumes[]` per feature.
- Changing the semantics of `owns[]` (settled by remediation).
- Reverse-impact enforcement gates (would be a separate harness
  feature, e.g. `harness.impact-graph`).
- External (`node_modules`) imports — `package.json` is their manifest.

## Success criteria

- `consumes[]` populated for all 91 features by deterministic derivation.
- `spec:check` does not flag `consumes[]` as overlap.
- Re-running `derive.mjs` is idempotent (zero manifest diff if imports
  unchanged).
- Leaky-abstraction report enumerates cross-feature imports of files
  outside the consumed feature's documented boundary.
- **Wall-clock target: ≤ 25 minutes** from spec approval to merged
  feature (via four parallel streams — see `lld.md`).

## Cheap-model friendliness

This feature is **strictly mechanical**. No LLM step exists at runtime.
The implementation may use subagents to *write* the scripts, but the
derive/verify loop never invokes a model. This avoids the
context-rot, cite-or-flag, and confidence-calibration concerns that
shape every other harness feature. Cheaper still than capsule format.

## Related artifacts

- `spec/harness/spec-remediation/lld.md` — the prior cleanup whose
  normalised `owns[]` makes this addition cleanly definable.
- `docs/harness-audit.md` § 2026-06-30 Still Open — should be amended
  with this gap and its closure once shipped.
- `scripts/harness/spec-manifest/generate-spec-index.mjs` — current
  owner of the `conventions` block; co-owned during this feature for
  the schema extension only.
- `scripts/harness/spec-manifest/spec-check.mjs` — current owner of
  overlap calc; co-owned for the additive guard only.
