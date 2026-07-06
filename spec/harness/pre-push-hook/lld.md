# harness.pre-push-hook — Low Level Design

## Feature summary

`harness.pre-push-hook` adds a deterministic local gate that runs before `git push`.
The hook fails fast on verification drift and blocks push until issues are resolved.

This is Layer 2 enforcement from the audit priority queue.

---

## Phase map

```
Phase 1 — Pre-push runner script              (core gate execution)
Phase 2 — Hook installer/wiring               (git hook registration)
Phase 3 — Harness-state contract check        (feature-status consistency)
Phase 4 — Docs + manifest registration        (harness docs/spec index wiring)

Phases 1,2,3 can be built in parallel.
Phase 4 runs after 1–3 are merged.
```

---

## Implementation streams

### Stream A — Pre-push runner

**Owns (create):**
- `scripts/harness/pre-push-hook/run-pre-push.mjs`

**CLI contract:**
```bash
node scripts/harness/pre-push-hook/run-pre-push.mjs [--dry-run]
```

**Execution contract:**

Runs, in order, with impact-based gating:

1. `pnpm run type-check` *(only when quality-impacting paths changed)*
2. `pnpm run lint` *(only when quality-impacting paths changed)*
3. `pnpm spec:check:strict` *(always)*
4. `node scripts/harness/pre-push-hook/verify-feature-status.mjs` *(always)*

If any command exits non-zero, stop immediately and return non-zero.

Output format:
- One-line status per gate: `PASS | FAIL`
- Failing command tail (last ~20 lines)
- Summary block with exact rerun command.

---

### Stream B — Hook installer/wiring

**Owns (create/modify):**
- `scripts/harness/pre-push-hook/install.mjs`
- `.github/hooks/hooks.json` (or existing hook bootstrap location)

**Behavior:**

- Registers a `pre-push` hook that invokes `run-pre-push.mjs`.
- Idempotent install; re-running installer does not duplicate entries.
- Never modifies unrelated hooks.

---

### Stream C — feature-status contract checker

**Owns (create):**
- `scripts/harness/pre-push-hook/verify-feature-status.mjs`

**Rule set (minimum):**

For each feature in `.harness/feature-status.json`:

1. If `status === "done"`, then all `verification[].passing === true`.
2. If `passingRequiresEvidence === true`, each passing verification has corresponding evidence.
3. If `singleActiveFeature === true`, at most one feature is `in-progress`.

Exit non-zero on violation; print machine-readable diagnostics.

---

### Stream D — Spec/HLD registration

**Owns (modify):**
- `spec/harness/hld.md`
- `spec/index.json` (feature registration)

Adds `harness.pre-push-hook` as planned/in-progress with owned script paths.

---

## Acceptance criteria (implementation-ready)

### Functional acceptance

- [ ] `run-pre-push.mjs` executes all required gates in strict order and fails fast.
- [ ] Non-zero exit from any gate blocks push (pre-push hook exits non-zero).
- [ ] `verify-feature-status.mjs` enforces done-state and evidence invariants.
- [ ] Hook installation is idempotent and does not duplicate hook entries.
- [ ] `--dry-run` prints planned gate sequence without mutating hook files.

### Quality acceptance

- [ ] `pnpm run type-check` passes.
- [ ] `pnpm run lint` passes.
- [ ] `pnpm run build` passes.
- [ ] `pnpm spec:check` passes with no new overlap/ghost findings from this feature.

### UX acceptance

- [ ] Failure output identifies exact failing gate and rerun command.
- [ ] Success output is concise (single summary line + timing).
- [ ] Median runtime for clean repo pre-push check is < 90s on warm cache.

### Safety acceptance

- [ ] No auto-commit / auto-push behavior.
- [ ] No destructive git operations.
- [ ] No schema migrations or DB writes.

---

## Anti-loop design (credit optimization)

The hook itself should not trigger open-ended repair loops.

Use a bounded auto-repair policy in implementation agents:

1. Run targeted autofix only for explicitly autofixable lint issues in touched files.
2. Re-run targeted lint + type-check once.
3. If still failing, return blocked with diagnostics.

This prevents repeated “fix after handoff” loops while keeping humans out of nominal flow.

---

## Open questions

1. Should local pre-push run full-repo lint/type-check always, or changed-files-only mode first with fallback to full?
2. Should status verification become a shared harness utility consumed by `session-close` too?
3. Should hook runner emit JSON for future CI parity, or keep stdout-only for now?

Leaning:
- start strict with impact-based quality gating;
- extract shared utility only after 2+ features consume it;
- emit human output first, add JSON in follow-up if needed.
