# Harness Progress — Current Handoff

**One entry = the active workstream.** Completed entries move to `progress-history.md`.
Agents: read this file at session start to know exactly what to work on next.

---

## 2026-07-28 — harness.eval-rubric — IN PROGRESS

### Verification gate (auto-stamped by close.mjs @ 9435fb3)

| Check | Result |
|---|---|
| `pnpm run type-check` | ✅ exit 0, no output |
| `pnpm run lint` | ✅ exit 0,   1:1  warning  Run autofix to sort these imports!  simple-import-sort/imports | ✖ 1 problem (0 errors, 1 warning) |   0 errors and 1 warning potentially fixable with the `--fix` option. |
| `pnpm spec:check` | ✅ drift=45 overlap=0 ghost=0 sha-missing=0 review=10 |

### What was done
<!-- close.mjs: populated from feature-status.json notes field -->
Implemented the eval-rubric feature across Phase 1–4: the rubric doc now spells out deterministic scoring rules, the five evaluator modules are in place, JSONL training output and summary reporting are deterministic, and the orchestrator writes the eval artifacts from feature-status traces. I also ran the required verification gates and the final build. The feature snapshot still shows the rubric checklist items as open, so the harness state remains in-progress.

### Open verification items
<!-- close.mjs: list verification[].passing===false, or "None — feature complete" -->
- [ ] `rubric-definition`: .ai/instructions/eval-rubric.md defines reward schema, edge cases, and deterministic constraints
- [ ] `evaluator-modules`: All 5 evaluator modules exist and produce deterministic scores
- [ ] `jsonl-output`: run.mjs writes .harness/training-data.jsonl in stable order
- [ ] `summary-output`: run.mjs writes .harness/eval-summary.json and prints a readable summary

### Next up
<!-- Agent: replace this block with narrative + chosen workstream -->
<!-- Planned features from feature-status.json with status:"planned" or "in-progress": -->
_No other planned or in-progress features._

### Next session starts at
<!-- Agent: fill in the specific file + section or command to resume from -->
No follow-on workstream is listed; if continuing eval-rubric, start from `.harness/feature-status.json` verification items.
