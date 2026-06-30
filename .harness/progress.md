# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-07-01 — Next up: downstream capsule wiring (Phase 3) OR pre-push hook

**Workstream options (pick one, confirm with user):**

### Option A — Phase 3: wire `implement-from-spec` to use capsules (recommended)
Now that 95 `capsule.md` files exist, update the `implement-from-spec` skill so subagent prompts are hydrated from `capsule.md` rather than `lld.md`. This is the direct payoff of `harness.capsule-format` and the reason the audit rated Context Rot as the dominant failure mode.

- Spec: `spec/harness/capsule-format/lld.md` § Phase 3 — Downstream wiring
- Files to touch: `.agents/skills/implement-from-spec/SKILL.md`

### Option B — Pre-push hook (`harness.pre-push-hook`, audit P-Q #4)
Local Layer 2 enforcement: install a `pre-push` hook that runs `pnpm spec:check:strict` before any push. Trivial effort; keeps the boundary gate load-bearing.

- Spec: needs to be written (`prd-mode` first per AGENTS.md)
- Files to touch: `.harness/pre-push`, `.github/hooks/` or `.git/hooks/`

### Status of last session

| Item | State |
|---|---|
| `harness.capsule-format` implemented | ✅ committed |
| `docs/harness-audit.md` P-Q #6 | ✅ closed |
| `pnpm run build` after capsule-format | ⏳ Not yet run — run this first next session |

### Next session starts at

1. Run `pnpm run build` to close the last Verification Gate item for `harness.capsule-format`.
2. Confirm with user: Option A (downstream wiring) or Option B (pre-push hook)?
3. If Option A: read `.agents/skills/implement-from-spec/SKILL.md`, then edit to replace `lld.md` auto-load with `capsule.md` hydration.

### Predecessor lineage

- `harness.capsule-format` committed this session. Full record in `progress-history.md`.
- `harness.consumes-derivation` shipped earlier; `consumes[]` data available for capsule "Consumed by" sections.

