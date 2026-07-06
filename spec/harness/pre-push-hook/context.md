# harness.pre-push-hook — Context

## Problem

The harness now has strong state artifacts (`.harness/feature-status.json`, `progress.md`) and deterministic checks (`pnpm spec:check`), but enforcement is still mostly procedural. This allows drift between:

1. actual code state,
2. feature-status verification flags, and
3. spec/manifest truth.

The audit already identifies this as the highest-value missing Layer 2 control: a local pre-push gate that blocks pushes when core harness checks fail.

## Why this matters now

Recent feature delivery showed two recurring credit-cost sinks:

- **state drift discovery late in the cycle** (audit had to happen after implementation had already progressed),
- **fix loops** (lint/type fixes iterated across multiple subagent turns).

A pre-push harness gate does not solve quality by itself, but it guarantees unresolved findings cannot silently cross the push boundary.

## Scope

In scope:

- Add a pre-push enforcement script under `scripts/harness/pre-push-hook/`.
- Wire local Git hook installation via repo automation script(s).
- Enforce a minimal hard gate before push:
  - `pnpm run type-check`
  - `pnpm run lint`
  - `pnpm spec:check:strict`
  - harness-status consistency check (`feature-status.json` done rules)
- Emit concise machine- and human-readable failure output.

Out of scope:

- CI replacement (this is local Layer 2, not remote policy).
- Auto-committing, auto-pushing, or destructive git operations.
- Weekly scheduled triage workflows (`harness.weekly-corrective`).
- Automatic semantic repair of source code across the repo.

## Human-in-the-loop stance

The default path should stay automated. Human intervention is only required when the bounded auto-repair loop cannot resolve issues deterministically.

That means:

- if autofixable lint ordering/layout exists, fix locally in-phase before handoff;
- if strict checks still fail after bounded retries, mark blocked with exact command output and stop.

This keeps humans out of normal flow while still preventing silent bad pushes.

## Success criteria

- Failed local quality/spec/harness-state checks prevent push.
- Passing checks allow push without manual workaround steps.
- Hook output clearly identifies the failing gate and next action.
- Hook runtime is fast enough for routine use (target: < 90s median on warm runs).
- No Tier 3 operations are performed automatically.

## Related artifacts

- `docs/harness-audit.md` — audit P-Q #4 (Layer 2 enforcement).
- `.harness/feature-status.json` — done/verification contract.
- `scripts/harness/spec-manifest/spec-check.mjs` — strict spec gate.
- `spec/harness/session-close/` — complements end-of-session automation.
