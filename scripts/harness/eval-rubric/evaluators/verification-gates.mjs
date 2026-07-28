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

function evidenceItems(feature) {
  return Array.isArray(feature?.evidence) ? feature.evidence : [];
}

function hasPassingEvidence(feature, id, passMatcher) {
  return evidenceItems(feature).some(item => {
    if (item?.id !== id) return false;
    const result = typeof item.result === 'string' ? item.result.toLowerCase() : '';
    return passMatcher(result);
  });
}

export function evaluateVerificationGates(_beforeFeature, afterFeature) {
  const featureId = afterFeature?.id ?? 'unknown';
  const gatesPassing = {
    typeCheck: hasPassingEvidence(afterFeature, 'type-check', result => result.includes('exit 0')),
    lint: hasPassingEvidence(afterFeature, 'lint', result => result.includes('exit 0')),
    specCheck: hasPassingEvidence(afterFeature, 'spec-check', result => result.includes('drift=') && !result.includes('error')),
  };

  const passCount = Object.values(gatesPassing).filter(Boolean).length;

  return [
    createEval({
      featureId,
      category: 'verification-gates',
      decision: 'gate_confidence',
      reason: 'verification_gates_passed',
      reward: 0.2 * passCount,
      evidence: gatesPassing,
      context: { passCount },
    }),
  ];
}
