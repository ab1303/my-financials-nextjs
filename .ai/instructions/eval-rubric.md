# Eval Rubric — Harness Decision Scoring

This rubric turns harness state transitions into deterministic reward signals.
It is designed for local, reproducible scoring only (no network calls, no LLM).

## Input sources

- `.harness/feature-status.json`
- `spec:check` evidence embedded in `feature-status.json` (`evidence[].id === "spec-check"`)

## Code map (where each rubric part lives)

- Orchestrator: `scripts/harness/eval-rubric/run.mjs`
- Shared result helpers: `scripts/harness/eval-rubric/lib/result.mjs`
- Evaluators:
  - status transitions: `evaluators/status-transitions.mjs`
  - evidence linkage: `evaluators/evidence-recording.mjs`
  - gate confidence: `evaluators/verification-gates.mjs`
  - blocker lifecycle: `evaluators/blocker-lifecycle.mjs`
  - drift response: `evaluators/drift-response.mjs`
- Training output serializer: `output-formatters/training-data.mjs`
- Explainability summary: `reporters/eval-summary.mjs`
- Contract tests: `src/__tests__/unit/harness/eval-rubric.contracts.test.ts`

## Output contract

Each eval event must emit:

```json
{
  "featureId": "harness.eval-rubric",
  "category": "status-transitions",
  "decision": "status_transition",
  "reason": "correct_transition_all_gates_cleared",
  "reward": 1.0,
  "timestamp": "2026-07-06",
  "evidence": {},
  "context": {}
}
```

Reward is always normalized to `[-1.0, 1.0]`.

## Categories and scoring

### 1) Status transitions

- `in-progress → done` and all verification items pass: `+1.0`
- `in-progress → done` with failing verification: `-1.0`
- `in-progress → in-progress` with additional passing checks: `+0.3 * deltaChecks` (clamped to `1.0`)

Example:

- before: `in-progress`, two checks passing
- after: `in-progress`, three checks passing
- result: `+0.3`

### 2) Evidence recording

Per passing verification item:

- matching evidence exists: `+0.5`
- evidence missing: `-0.3`

Example:

- verification `lint` is passing
- evidence contains `{"id":"lint", ...}`
- result: `+0.5`

### 3) Verification gates

Gate pass signals (from evidence):

- `type-check` pass: `+0.2`
- `lint` pass: `+0.2`
- `spec-check` pass: `+0.2`

Total for this category is `0.2 * passCount` (max `+0.6`).

Example:

- evidence includes `type-check` and `lint`
- result: `+0.4`

### 4) Blocker lifecycle

- blockers cleared and `blocked → in-progress`: `+0.7`
- blockers cleared but still `blocked`: `-0.2`

Example:

- before blockers: `[...something...]`
- after blockers: `[]`
- before status: `blocked`
- after status: `in-progress`
- result: `+0.7`

### 5) Drift response

If drift is detected (`spec-check` summary reports `drift > 0`):

- notes include `drift:defer` / `drift:fixed` / `drift:escalate`: `+0.5`
- no documented drift decision: `-0.4`

Example:

- `spec-check` reports `drift=12`
- feature notes include `drift:defer`
- result: `+0.5`

## Edge cases

1. **Cold start feature:** if no previous snapshot exists, transition-only evals skip.
2. **Missing arrays:** absent `verification`, `evidence`, or `blockers` are treated as empty arrays.
3. **Missing `spec-check` evidence:** drift-response category skips for that feature.
4. **Timestamp source:** use feature `completedAt` if present; otherwise use `feature-status.updatedAt`.
5. **Duplicate evidence:** multiple evidence rows for the same verification id do not stack reward.
6. **Unknown ids:** evidence ids that do not match a known verification or gate are ignored.

## Determinism requirements

- Same input files must produce byte-identical JSONL output.
- Stable ordering: by `featureId`, then `category`, then `reason`.
- No random IDs, no current-time timestamps in eval rows.
- Do not round-trip through object key enumeration when a fixed field order is required.

## Maintenance guardrails (anti-drift)

1. Change rubric rules in this file first, then implement code changes.
2. Update/add contract tests for every rule change.
3. Run:
   - `pnpm run eval-rubric:explain`
   - targeted contract tests
   - `pnpm run type-check`
   - `pnpm run lint`
4. Reject PRs that change evaluator behavior without matching test expectation updates.
