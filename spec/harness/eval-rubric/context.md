# Eval-Rubric — Context

## Problem

Your harness has operational state (feature-status.json) and execution traces (remediation/log.md), but no **formal measurement rubric** that tells a model:

- _What decision did I just make?_
- _Was it correct?_
- _What reward/penalty should I get?_

Without evals, you have perfect operational infrastructure but no training signal for **Hybrid Agentic RL**—local fine-tuning of open-weights models on your repo-specific workflows.

## Vision

Formalize the harness ruleset as an evaluator that:

1. **Reads** feature-status.json, remediation logs, spec:check output
2. **Measures** whether harness decisions were correct:
   - Status transition rules: `in-progress → done` only when all verification[].passing
   - Evidence recording: every passing verification has proof
   - Capsule generation: triggered when LLD > 800 tokens
   - Blocker handling: features transition correctly when blockers clear
3. **Assigns** reward/penalty for each decision
4. **Outputs** training data (JSONL) for fine-tuning open-weights models

## Design Principle: Deterministic Evals, Cheap to Run

- No LLM in the eval loop (speed, cost, reproducibility)
- Rules read from `eval-rubric.md` (human-written, versioned)
- Evals run on local data (feature-status.json, remediation traces)
- Output is reproducible: same input → same scores → same training data

## Scope

**In scope:**

- Feature lifecycle evals (status transitions)
- Evidence recording (proof linkage)
- Verification gate evals (when all checks pass)
- Blocker lifecycle (blocked → in-progress)
- Drift response evals (when should drift be ignored vs. fixed?)

**Out of scope:**

- Evaluating the correctness of individual code changes (that's the CI/CD pipeline)
- Grading spec quality (that's spec:check drift detection)
- Performance profiling (that's separate observability)

## Connection to Hybrid Agentic Engineering

The user's broader vision: train local open-weights models to handle the 20% of work your harness does (state packing, trace recording, decision routing) while Claude handles the 80% (code changes, architectural decisions).

Evals are the bridge: they define what "correct 20% work" looks like, generating training data for that fine-tuning pipeline.

## Audit Context

Audit finding (2026-06-30 re-audit):

> _"You have load-bearing outputs; you need to export them as a training dataset."_

Evals are that export mechanism. They convert operational traces into labeled training examples.
