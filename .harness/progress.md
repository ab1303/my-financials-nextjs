# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-07-07 — harness.eval-rubric — IN PROGRESS

### Verification gate (auto-stamped by close.mjs @ e3b1b87)

| Check | Result |
|---|---|
| `pnpm run type-check` | ✅ exit 0, no output |
| `pnpm run lint` | ✅ exit 0, no output |
| `pnpm spec:check` | ✅ drift=45 overlap=0 ghost=0 sha-missing=0 review=10 |

### What was done
<!-- close.mjs: populated from feature-status.json notes field -->
Implemented `harness.eval-rubric` end-to-end: rubric instruction doc, five evaluator modules, shared result helpers, JSONL formatter, summary reporter, and orchestrator CLI wiring.
Added explainability support (`--explain`) and richer summary breakdowns by category/reason/feature to make scoring behavior inspectable.
Added contract tests for evaluator behavior and deterministic output ordering, then refreshed session-close state and spec metadata stamping.
Updated harness HLD to avoid duplicate status tracking and point status reads to source-of-truth files.

### Open verification items
<!-- close.mjs: list verification[].passing===false, or "None — feature complete" -->
- [ ] `rubric-definition`: .ai/instructions/eval-rubric.md defines reward schema, edge cases, and deterministic constraints
- [ ] `evaluator-modules`: All 5 evaluator modules exist and produce deterministic scores
- [ ] `jsonl-output`: run.mjs writes .harness/training-data.jsonl in stable order
- [ ] `summary-output`: run.mjs writes .harness/eval-summary.json and prints a readable summary

### Next up
<!-- Agent: replace this block with narrative + chosen workstream -->
`harness.weekly-corrective` — start by scaffolding `spec/harness/weekly-corrective/{context.md,lld.md,capsule.md}` and registering the feature in `.harness/feature-status.json` + `spec/index.json`.

### Next session starts at
<!-- Agent: fill in the specific file + section or command to resume from -->
Open `spec/harness/hld.md` (catalogue section), then create the weekly-corrective spec slice and run `pnpm run spec:check` after registration edits.
