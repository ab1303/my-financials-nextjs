/**
 * Verification gate confidence evaluator.
 *
 * Purpose:
 * - Convert deterministic gate evidence (type-check, lint, spec-check)
 *   into a single confidence reward signal.
 *
 * Input contract:
 * - Reads afterFeature.evidence[].id/result.
 */
import { createEval } from '../lib/result.mjs';

function hasPassingEvidence(feature, id, passMatcher) {
  return (feature.evidence ?? []).some(item => {
    if (item?.id !== id) return false;
    const result = typeof item.result === 'string' ? item.result.toLowerCase() : '';
    return passMatcher(result);
  });
}

export function evaluateVerificationGates(_beforeFeature, afterFeature) {
  const gatesPassing = {
    typeCheck: hasPassingEvidence(afterFeature, 'type-check', result => result.includes('exit 0')),
    lint: hasPassingEvidence(afterFeature, 'lint', result => result.includes('exit 0')),
    specCheck: hasPassingEvidence(afterFeature, 'spec-check', result => result.includes('drift=') && !result.includes('error')),
  };

  const passCount = Object.values(gatesPassing).filter(Boolean).length;

  return [
    createEval({
      featureId: afterFeature.id,
      category: 'verification-gates',
      decision: 'gate_confidence',
      reason: 'verification_gates_passed',
      reward: 0.2 * passCount,
      evidence: gatesPassing,
      context: { passCount },
    }),
  ];
}
