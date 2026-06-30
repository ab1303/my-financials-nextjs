# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-07-01 — Next up: Option A — wire `implement-from-spec` to use capsules

### Status of last session

| Item | State |
|---|---|
| `harness.capsule-format` implemented | ✅ committed (b447cd8) |
| `pnpm run build` after capsule-format | ✅ passed — all 9 verification items now passing |
| `harness.session-close` spec written | ✅ `spec/harness/session-close/` created; registered in manifest (96 features) |
| `docs/harness-audit.md` P-Q #6 | ✅ closed |

### Chosen workstream: Option A — capsule hydration in `implement-from-spec`

Now that 95 `capsule.md` files exist, update the `implement-from-spec` skill so that
subagent prompts are hydrated from `capsule.md` rather than raw `lld.md`. This is the
direct payoff of `harness.capsule-format` and addresses Context Rot — the #1 failure
mode from the harness audit.

**What this task entails:**

The `implement-from-spec` SKILL.md (Step 1 and Step 4) currently reads `context.md` +
`lld.md` raw and pastes them into subagent prompts. The change:

- **Step 1**: After resolving the feature, check for `spec/{domain}/{feature}/capsule.md`.
  If it exists and is not stale (`pnpm spec:check` clean), use it as the primary context source.
  Fall back to `lld.md` if no capsule exists.
- **Step 4b**: Replace the "paste context.md excerpt + LLD phase section" with
  "paste `capsule.md` (full, ≤800 tokens) + extract the specific Phase N section from `lld.md`".
  The capsule provides: Purpose, owns[], consumes[], invariants, declared interfaces.
  The phase section provides: the specific implementation task.
- **Net effect**: subagent prompts shrink; gpt-5.4-mini stays within context budget;
  no more manual copy-pasting of potentially-stale lld.md excerpts.

**File to touch:**
- `.agents/skills/implement-from-spec/SKILL.md` — Step 1 (feature resolution) + Step 4 (context bundle)

**Spec reference:**
- `spec/harness/capsule-format/lld.md` § "Phase 3 — Downstream wiring"

### Next session starts at

1. Read `.agents/skills/implement-from-spec/SKILL.md` Steps 1 and 4 (lines ~60–200).
2. Read a sample `capsule.md` (e.g. `spec/harness/capsule-format/capsule.md`) to understand the format.
3. Edit SKILL.md to add capsule hydration in Step 1 + Step 4.
4. Run `pnpm run type-check` + `pnpm run lint` + `pnpm spec:check` (lint/type-check trivial since it's a .md edit; spec:check verifies capsule.md for SKILL.md doesn't exist — that's expected).

### Predecessor lineage

- `harness.capsule-format` shipped 2026-07-01. 95 capsule.md files. Full record in `progress-history.md`.
- `harness.session-close` specced 2026-07-01. Planned for future implementation.

