import { describe, expect, it } from 'vitest';

import { evaluateBlockerLifecycle } from '../../../../scripts/harness/eval-rubric/evaluators/blocker-lifecycle.mjs';
import { evaluateDriftResponse } from '../../../../scripts/harness/eval-rubric/evaluators/drift-response.mjs';
import { evaluateEvidenceRecording } from '../../../../scripts/harness/eval-rubric/evaluators/evidence-recording.mjs';
import { evaluateStatusTransitions } from '../../../../scripts/harness/eval-rubric/evaluators/status-transitions.mjs';
import { evaluateVerificationGates } from '../../../../scripts/harness/eval-rubric/evaluators/verification-gates.mjs';
import { toTrainingDataJsonl } from '../../../../scripts/harness/eval-rubric/output-formatters/training-data.mjs';
import { summarizeEvals } from '../../../../scripts/harness/eval-rubric/reporters/eval-summary.mjs';

describe('eval-rubric contracts', () => {
  it('scores a valid in-progress -> done transition', () => {
    const beforeFeature = { id: 'feature.a', status: 'in-progress', verification: [{ id: 'type-check', passing: false }] };
    const afterFeature = { id: 'feature.a', status: 'done', verification: [{ id: 'type-check', passing: true }] };

    const results = evaluateStatusTransitions(beforeFeature, afterFeature);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      reason: 'correct_transition_all_gates_cleared',
      reward: 1,
    });
  });

  it('penalizes missing evidence for passing verification', () => {
    const afterFeature = {
      id: 'feature.b',
      verification: [{ id: 'lint', description: 'lint pass', passing: true }],
      evidence: [],
    };

    const results = evaluateEvidenceRecording({}, afterFeature);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      reason: 'missing_evidence',
      reward: -0.3,
    });
  });

  it('scores verification gate confidence from evidence', () => {
    const afterFeature = {
      id: 'feature.c',
      evidence: [
        { id: 'type-check', result: 'exit 0, no output' },
        { id: 'lint', result: 'exit 0, no output' },
        { id: 'spec-check', result: 'drift=0 overlap=0 ghost=0 sha-missing=0 review=0' },
      ],
    };

    const results = evaluateVerificationGates({}, afterFeature);
    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.reason).toBe('verification_gates_passed');
    expect(result.reward).toBeCloseTo(0.6, 8);
  });

  it('rewards blocker-cleared transition correctness', () => {
    const beforeFeature = { id: 'feature.d', status: 'blocked', blockers: ['waiting'] };
    const afterFeature = { id: 'feature.d', status: 'in-progress', blockers: [] };

    const results = evaluateBlockerLifecycle(beforeFeature, afterFeature);
    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result).toMatchObject({
      reason: 'blocker_cleared_transition_correct',
      reward: 0.7,
    });
  });

  it('scores drift response based on decision token in notes', () => {
    const afterFeatureWithDecision = {
      id: 'feature.e',
      notes: 'drift:defer until weekly corrective',
      evidence: [{ id: 'spec-check', result: 'drift=4 overlap=0 ghost=0' }],
    };
    const afterFeatureWithoutDecision = {
      id: 'feature.f',
      notes: 'no explicit decision',
      evidence: [{ id: 'spec-check', result: 'drift=2 overlap=0 ghost=0' }],
    };

    const rewardedResults = evaluateDriftResponse({}, afterFeatureWithDecision);
    const penalizedResults = evaluateDriftResponse({}, afterFeatureWithoutDecision);
    expect(rewardedResults).toHaveLength(1);
    expect(penalizedResults).toHaveLength(1);
    const rewarded = rewardedResults[0]!;
    const penalized = penalizedResults[0]!;
    expect(rewarded).toMatchObject({ reason: 'drift_decision_documented', reward: 0.5 });
    expect(penalized).toMatchObject({ reason: 'drift_response_missing', reward: -0.4 });
  });

  it('formats JSONL deterministically by feature/category/reason', () => {
    const jsonl = toTrainingDataJsonl(
      [
        { featureId: 'z.feature', category: 'b', decision: 'd', reason: 'r2', reward: 0, evidence: {}, context: {} },
        { featureId: 'a.feature', category: 'a', decision: 'd', reason: 'r1', reward: 1, evidence: {}, context: {} },
      ],
      '2026-07-07T00:00:00.000Z'
    );
    const [first] = jsonl.split('\n');
    expect(first).toContain('"featureId":"a.feature"');
  });

  it('includes explainability fields in summary', () => {
    const summary = summarizeEvals([
      { featureId: 'f1', category: 'status-transitions', reason: 'correct_transition_all_gates_cleared', reward: 1 },
      { featureId: 'f1', category: 'drift-response', reason: 'drift_response_missing', reward: -0.4 },
    ]);

    expect(summary.byCategory['status-transitions']).toBe(1);
    expect(summary.byReason['drift_response_missing']).toBe(1);
    expect(summary.byFeature['f1']).toBe(2);
    expect(summary.topNegativeReasons[0]).toMatchObject({ reason: 'drift_response_missing', count: 1 });
  });
});
