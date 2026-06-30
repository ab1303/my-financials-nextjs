# harness.session-close — Context

## Problem

Every session ends with 5–6 mechanical steps that the agent performs by hand:

1. Run `pnpm run type-check`, `pnpm run lint`, `pnpm spec:check` — record results
2. Update `feature-status.json` — stamp `verification[].passing` + set `status: "done"` when all pass
3. Move the current `progress.md` entry to `progress-history.md` (if feature is complete)
4. Write a new `progress.md` entry with verification results, what was done, and what's next
5. Stamp `lastVerifiedSha` in `spec/index.json` for the active feature
6. Stage harness files and print the commit command

These steps are fully deterministic (steps 1, 2, 3, 5) or mostly-template with a
small narrative placeholder (step 4). They cannot be skipped — they're the session
lifecycle contract described in `AGENTS.md`. But they're also error-prone: the
previous session ended with a duplicate header in `progress.md`, a missing build
evidence entry, and a `lastVerifiedSha: null` that was never stamped.

## Motivation

A `close.mjs` script that handles steps 1–5 automatically:
- **Eliminates the duplicate-header class of bug** (the script overwrites progress.md completely, using a template)
- **Guarantees the handoff is always machine-readable** (no half-filled tables, no missing gate rows)
- **Reduces cognitive load at session end** — the agent runs one command, reads the diff-style output, extends the narrative placeholder, then commits

Step 6 (commit) remains manual. `AGENTS.md` Hard Constraint: every `git commit` requires explicit user confirmation. The script stages harness files and prints the commit command; it never calls `git commit` itself.

## Scope

**In scope:**
- `scripts/harness/session-close/close.mjs` — the script
- `.github/hooks/hooks.json` — add `sessionEnd` hook (safety net; runs with `|| true`)
- `AGENTS.md` Session Lifecycle § End — update to reference close.mjs
- Spec files + manifest registration (this feature)

**Out of scope:**
- Auto-updating `lld.md` acceptance criteria (feature-specific; requires judgment)
- Auto-updating `docs/harness-audit.md` (requires LLM judgment)
- Multi-feature sessions (`singleActiveFeature` rule in `feature-status.json` — one at a time)
- Auto-committing (Hard Constraint — always requires user confirmation)

## Success criteria

A session-end that previously took 5–6 manual edit steps is replaced by:

```
node scripts/harness/session-close/close.mjs
# agent reviews printed diff
# agent extends the <!-- narrative --> placeholder
# user confirms: git commit -m "..."
```

## Related

- `AGENTS.md` Session Lifecycle section — the rules this script encodes
- `.harness/feature-status.json` — the state file the script updates
- `.harness/progress.md` / `.harness/progress-history.md` — the rotation files
- `spec/index.json` — `lastVerifiedSha` stamping
- `harness.capsule-format` — produced the capsule digest infrastructure; session-close is the next downstream harness infrastructure piece
