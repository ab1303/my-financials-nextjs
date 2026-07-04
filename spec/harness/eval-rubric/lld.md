# Eval-Rubric — Low-Level Design

## Owned Files & Scope

```
.ai/instructions/eval-rubric.md              ← Formal criteria + reward schema
scripts/harness/eval-rubric/                 ← Implementation
  run.mjs                                    ← Main orchestrator
  evaluators/
    status-transitions.mjs                   ← Feature lifecycle evals
    evidence-recording.mjs                   ← Proof linkage evals
    verification-gates.mjs                   ← When all checks pass
    blocker-lifecycle.mjs                    ← Blocked → in-progress
    drift-response.mjs                       ← Drift handling decisions
  output-formatters/
    training-data.mjs                        ← JSONL serializer
  reporters/
    eval-summary.mjs                         ← Human-readable report
```

**Bucket:** `services` (harness scripts)
**Last verified:** TBD
**Drift signal:** None (new feature)

---

## What the Rubric Covers

### 1. Status Transition Evals

**Rule: `in-progress → done` valid only when all verification[].passing === true**

```javascript
// Input: feature-status.json[i] before & after
// Output: reward signal

if (before.status === 'in-progress' && after.status === 'done') {
  const allPassing = after.verification.every((v) => v.passing);
  const beforeIncomplete = before.verification.some((v) => !v.passing);

  if (allPassing && beforeIncomplete) {
    return {
      reward: 1.0,
      reason: 'correct_transition_all_gates_cleared',
      evidence: { completedChecks: after.verification.length },
    };
  }

  if (!allPassing) {
    return {
      penalty: -1.0,
      reason: 'premature_transition',
      evidence: {
        failing: after.verification.filter((v) => !v.passing).map((v) => v.id),
      },
    };
  }
}

if (before.status === 'in-progress' && after.status === 'in-progress') {
  // No state change — check if progress was made on verification items
  const completedThisSession =
    after.verification.filter((v) => v.passing).length -
    before.verification.filter((v) => v.passing).length;

  if (completedThisSession > 0) {
    return {
      reward: 0.3 * completedThisSession,
      reason: 'incremental_progress',
      evidence: { checksCompleted: completedThisSession },
    };
  }
}
```

**Weights:** +1.0 correct, -1.0 premature, +0.3 per incremental check

---

### 2. Evidence Recording Evals

**Rule: Every verification[].passing === true must have ≥1 entry in evidence[]**

```javascript
// Input: feature-status.json[i]
// Output: reward signal per verification item

after.verification.forEach((verif) => {
  if (verif.passing) {
    const hasEvidence = after.evidence.some((e) => e.id === verif.id);

    if (hasEvidence) {
      return {
        reward: 0.5,
        reason: 'evidence_recorded',
        evidence: { verificationId: verif.id },
      };
    } else {
      return {
        penalty: -0.3,
        reason: 'missing_evidence',
        evidence: { verificationId: verif.id, description: verif.description },
      };
    }
  }
});
```

**Weights:** +0.5 for recorded proof, -0.3 for missing proof

**Evidence shape:** `{ id, sha, command, result }` (proof is immutable + commit-linked)

---

### 3. Verification Gate Evals

**Rule: All gates (type-check, lint, spec:check) passing → confidence boost**

```javascript
// Input: evidence[] for the session
// Output: combined confidence signal

const gatesPassing = {
  typeCheck: evidence.some(
    (e) => e.id === 'type-check' && e.result === 'exit 0',
  ),
  lint: evidence.some((e) => e.id === 'lint' && e.result === 'exit 0'),
  specCheck: evidence.some(
    (e) => e.id === 'spec-check' && !e.result.includes('error'),
  ),
};

const passCount = Object.values(gatesPassing).filter(Boolean).length;

return {
  reward: 0.2 * passCount, // +0.2 per gate
  reason: 'verification_gates_passed',
  evidence: gatesPassing,
};
```

**Weights:** +0.2 per passing gate (max +0.6 for all three)

---

### 4. Blocker Lifecycle Evals

**Rule: When feature.blockers becomes empty, status should move `blocked → in-progress`**

```javascript
// Input: feature state before & after
// Output: reward signal

if (before.blockers.length > 0 && after.blockers.length === 0) {
  if (before.status === 'blocked' && after.status === 'in-progress') {
    return {
      reward: 0.7,
      reason: 'blocker_cleared_transition_correct',
      evidence: { previousBlockers: before.blockers },
    };
  }

  if (before.status === 'blocked' && after.status === 'blocked') {
    return {
      penalty: -0.2,
      reason: 'blocker_cleared_but_status_not_updated',
      evidence: { previousBlockers: before.blockers },
    };
  }
}
```

**Weights:** +0.7 correct, -0.2 missed transition

---

### 5. Drift Response Evals

**Rule: When spec:check reports drift, decision is recorded in feature notes**

```javascript
// Input: spec:check output + feature-status.json
// Output: decision signal

const specCheckDrift = parseSpecCheck(output); // drift=44, ...

if (specCheckDrift.total > 0) {
  const hasDriftDecision =
    feature.notes &&
    (feature.notes.includes('drift:defer') ||
      feature.notes.includes('drift:fixed') ||
      feature.notes.includes('drift:escalate'));

  if (hasDriftDecision) {
    return {
      reward: 0.5,
      reason: 'drift_decision_documented',
      evidence: { driftCount: specCheckDrift.total, decision: feature.notes },
    };
  } else {
    return {
      penalty: -0.4,
      reason: 'drift_response_missing',
      evidence: { driftCount: specCheckDrift.total },
    };
  }
}
```

**Weights:** +0.5 documented decision, -0.4 silent drift

---

## Implementation Plan

### Phase 1: Rubric Definition (2-3 hours)

**Deliverables:**

- `.ai/instructions/eval-rubric.md` with formal criteria
- JSON Schema for rule definitions (optional but recommended)
- Documentation of reward ranges and edge cases

**Acceptance:**

- [ ] Rubric covers all 5 eval categories
- [ ] Reward ranges are [-1.0, +1.0] normalized
- [ ] Edge cases documented (e.g., new feature with no prior state)
- [ ] Examples for each rule

### Phase 2: Evaluator Scripts (4-5 hours)

**Deliverables:**

- `scripts/harness/eval-rubric/evaluators/*.mjs` (5 modules)
- Each evaluator exports `(stateBefore, stateAfter) => EvalResult[]`
- `EvalResult` shape: `{ reward, reason, evidence }`

**Acceptance:**

- [ ] All evaluators run deterministically (no randomness)
- [ ] No external dependencies (JSON parsing only)
- [ ] Handles edge cases (new features, missing evidence fields)
- [ ] Unit tests for each evaluator (sample cases)

### Phase 3: Output Formatting (2-3 hours)

**Deliverables:**

- `scripts/harness/eval-rubric/output-formatters/training-data.mjs`
- Converts EvalResult[] → JSONL (one JSON object per line)
- Human-readable reporter for debugging

**Acceptance:**

- [ ] JSONL output parseable by standard tools
- [ ] Each line includes: decision, reward, context, timestamp
- [ ] Roundtrip: read JSONL → reconstruct decision history
- [ ] Report shows aggregate stats (mean reward, penalty distribution)

### Phase 4: Integration (2-3 hours)

**Deliverables:**

- `scripts/harness/eval-rubric/run.mjs` (orchestrator)
- Wired into `.harness/` session-end workflow
- Output goes to `.harness/training-data.jsonl`

**Acceptance:**

- [ ] `pnpm run eval-rubric` executes full pipeline
- [ ] Updates `.harness/training-data.jsonl` idempotently
- [ ] `spec:check` passes after eval-rubric changes
- [ ] Session-close skill calls eval-rubric before progress rotation

---

## Acceptance Criteria

### Functional

1. **Deterministic execution:** Running evaluators twice on same state produces identical scores
2. **Full coverage:** All 5 eval categories produce signals (no blind spots)
3. **Correct transitions:** Rubric correctly validates:
   - `in-progress → done` (all gates pass)
   - `blocked → in-progress` (blockers clear)
   - Evidence linkage (every passing check has proof)
4. **Training data:** JSONL output format suitable for Anthropic RL fine-tuning

### Integration

5. **Harness self-consistency:** Evals discover no violations of AGENTS.md tier rules
6. **Performance:** `pnpm run eval-rubric` on full history completes in <5s
7. **Session-end hook:** Session-close workflow auto-runs evals before progress rotation
8. **CI gate** (future): `pnpm spec:check` fails if eval-rubric produces findings

### Documentation

9. **Rubric completeness:** `.ai/instructions/eval-rubric.md` covers:
   - All 5 eval categories with examples
   - Reward/penalty semantics
   - Edge cases (new features, partial evidence, etc.)
   - Training use-case (how to feed JSONL to fine-tuning)
10. **Code comments:** Each evaluator has inline examples of correct & incorrect states

---

## Open Questions

1. **How should `lastVerifiedSha` relate to evals?** Should we auto-stamp it when evals pass, or keep it manual (current)?
   - **Direction:** Keep manual (explicit user confirmation per AGENTS.md Tier 3 rule).

2. **Should drift evals be mandatory or advisory?** If drift is detected but the decision is deferred, is that a penalty?
   - **Direction:** Advisory. Deferring drift is valid if documented; silent drift is the error.

3. **What's the cold-start behavior for new features?** Should a brand-new feature in "planned" status incur no penalty for missing evidence?
   - **Direction:** Yes. Evals only activate when status flips to "in-progress".

4. **Should remediation success (overlap patches applied) have reward signals?**
   - **Direction:** Out of scope for v1. Remediation is deterministic orchestration; evals focus on harness state decisions.

---

## Why This Matters

Evals convert your operational harness into a **labeled training dataset** for Hybrid Agentic RL:

```
┌──────────────────────────────────┐
│ Your execution traces            │
│ (feature-status.json history)    │
│                                  │
│ 2026-07-01 12:00:00              │
│   in-progress → done             │
│   +5 verification items passed   │
│   +3 evidence entries recorded   │
│                                  │
└──────────────────────────────────┘
              ↓ (evals score)
┌──────────────────────────────────┐
│ Training example (JSONL)          │
│                                  │
│ {                                │
│   decision: "status_transition", │
│   reward: 1.0,                   │
│   context: {...},                │
│   timestamp: "2026-07-01..."     │
│ }                                │
│                                  │
└──────────────────────────────────┘
              ↓ (RL fine-tuning)
┌──────────────────────────────────┐
│ Local model                      │
│ (trained on your workflows)      │
│                                  │
│ "When user says 'verify         │
│ all checks', I know to:          │
│  1. Read feature-status.json    │
│  2. Flip passing items          │
│  3. Record evidence[]           │
│  4. Suggest status transition"  │
│                                  │
└──────────────────────────────────┘
```

This is the foundation for **true local, repo-specific automation**.

---

## Next Steps After Acceptance

1. Integrate evals into `.harness/` session-end
2. Add `pnpm run eval-rubric:check` to CI (layer 2)
3. Export training data weekly for fine-tuning pipeline
4. Monitor eval distribution (are rewards clustering correctly?)
5. Iterate on rubric based on real decision traces
