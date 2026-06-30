# Capsule Format — Context

## Problem

Every harness feature today exposes a `context.md` (≈1–3 KB) and an
`lld.md` (≈5–15 KB) under `spec/{domain}/{feature}/`. When a subagent
is dispatched, the orchestrator's instinct is to auto-load the full
`lld.md` so the worker has "everything it needs." That instinct is
wrong for cheap models:

- Anthropic's July 2025 **Context Rot** study shows accuracy degrades
  log-linearly past ~30 K tokens. A single fat `lld.md` plus
  surrounding harness instructions routinely pushes a Haiku /
  `gpt-5-mini` worker past the rot threshold before it has written a
  single line.
- Most subagent tasks (renaming a field, adding a TRPC mutation,
  wiring a UI button) do not need the *full* design narrative — they
  need a **contract**: the file boundary, the invariants, the
  cross-feature consumers, and a pointer to the LLD if deeper context
  is required.
- Loading `lld.md` defeats the **Manifest-driven retrieval** principle
  (`docs/harness-learnings.md` § Cheap-Model Friendliness #2): cheap
  models burn budget re-reading prose they could have looked up.

The audit's P-Q #6 (2026-06-30) captures the fix:

> Replace ≥3 KB `lld.md` auto-load with ≤800-token `reference.md` per
> high-traffic feature.

That `reference.md` is what this feature ships, and it is hereafter
called a **capsule**.

## What a capsule is

A capsule is a deterministically-generated, hand-amendable
**≤800-token Markdown digest** of a single feature. It is the
first artifact a subagent receives. Its sole job is to answer the
five questions a cheap model needs to act safely:

1. **What does this feature own?** (canonical file list, by bucket)
2. **What invariants must I preserve?** (verbatim from manifest)
3. **What other features consume it?** (reverse `consumes[]` index)
4. **What gates run on it?** (type-check, lint, `spec:check`, custom)
5. **Where do I read more if I'm still unsure?** (links to
   `context.md` and `lld.md`, not their content)

Anything that does not directly serve one of those five questions does
not belong in a capsule.

## Why deterministic generation (not "write it by hand")

Capsules drift the moment the underlying spec changes if humans
curate them. The capsule must be:

- **Regenerable** from `spec/index.json` + the feature's `context.md`
  front-matter + a small per-feature `capsule.yml` override file
  (optional — only present when the feature needs hand-tuned wording).
- **Idempotent** — re-running the generator on an unchanged feature
  produces zero diff.
- **Verifiable** — `spec:check` (or a sibling script) fails when a
  capsule is stale relative to its source feature.

This mirrors `harness.consumes-derivation`'s philosophy: derived
artifacts have no LLM in their runtime loop.

## Scope

In scope:

- A `capsule.md` file per feature, generated under
  `spec/{domain}/{feature}/capsule.md` (co-located with the spec it
  summarises, not in a parallel tree).
- A deterministic generator at
  `scripts/harness/capsule-format/generate.mjs`.
- A staleness check at
  `scripts/harness/capsule-format/check.mjs`, wired into
  `pnpm spec:check`.
- A token-budget enforcer (≤800 tokens via `tiktoken` or a
  Claude-compatible BPE; capsules that exceed budget fail generation).
- Optional per-feature `capsule.yml` override (free-text "purpose"
  blurb + section overrides) preserved across regeneration.
- HLD update: add `harness.capsule-format` to the catalogue, remove
  from the planned list.

Out of scope:

- Auto-loading capsules into subagent prompts (the consumer side is
  `implement-from-spec` and `spec-remediation`; this feature only
  produces the artifact).
- Multi-feature "domain capsules" (one capsule per feature only;
  domain rollups are a future feature if needed).
- LLM-authored capsules (we are explicitly avoiding the cite-or-flag
  and confidence-calibration burden).
- Replacing `lld.md` or `context.md` — capsules **augment**, not
  replace, the existing spec slice.

## Success criteria

- Every feature in `spec/index.json` (currently 91) has a `capsule.md`
  under its spec folder.
- Every capsule is ≤800 tokens (measured via the same tokenizer the
  orchestrator will use to budget subagent prompts).
- `pnpm spec:check` fails when any capsule is stale (its source
  manifest entry or `context.md` has changed since the capsule's
  `lastGeneratedSha`).
- Re-running `generate.mjs` immediately after a clean run produces
  zero diff across all 91 capsules.
- Median capsule size lands in the 400–600 token band (leaves
  headroom for surrounding subagent harness text inside the 30 K
  context-rot threshold).

## Cheap-model friendliness

This feature is **fully mechanical**. Generation is regex + manifest
joins; no LLM is invoked at any point. The capsule's *consumers* are
cheap models, but its *producer* is not. This is by design — it keeps
this feature in the same "no runtime model" tier as
`harness.consumes-derivation`.

## Related artifacts

- `docs/harness-learnings.md` § Cheap-Model Friendliness #1 — the
  principle this feature operationalises.
- `docs/harness-audit.md` P-Q #6 — the finding this feature closes.
- `spec/harness/consumes-derivation/lld.md` — provides the
  `consumes[]` field that capsules surface as "who depends on me?".
- `spec/harness/spec-remediation/lld.md` — primary downstream
  consumer (its orchestrator should hydrate subagent prompts from
  capsules, not LLDs, once this ships).
- `scripts/harness/spec-manifest/spec-check.mjs` — gains an additive
  capsule-staleness check; co-owned for that delta only.
