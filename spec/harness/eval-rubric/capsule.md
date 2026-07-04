# Eval-Rubric — Capsule

**Feature:** `harness.eval-rubric`

Define measurable evaluation criteria and reward signals for harness decision-making. Enables local RL fine-tuning of open-weights models on repo-specific workflows.

**Key capabilities:**

- Formalize "what counts as success" for harness operations
- Assign reward/penalty values for RL training
- Generate training data (JSONL) from execution traces
- Measure harness self-consistency (does it follow its own rules?)

**Dependencies:** `feature-status.json` (v1.1), `spec:check` output, `remediation/log.md`

**Outputs:** `eval-rubric.md` (formal criteria), `training-data.jsonl` (for RL)

**Status:** Planned (audit P-Q #8)
