/**
 * Evidence linkage evaluator.
 *
 * Purpose:
 * - Ensure every passing verification item has traceable evidence.
 * - Reward complete evidence linkage and penalize missing proof.
 *
 * Input contract:
 * - Reads afterFeature.verification[] and afterFeature.evidence[].
 */
import { createEval } from '../lib/result.mjs';

export function evaluateEvidenceRecording(_beforeFeature, afterFeature) {
  const verification = afterFeature.verification ?? [];
  const evidenceIds = new Set(
    (afterFeature.evidence ?? []).map(item => item?.id).filter(Boolean)
  );

  const evals = [];
  for (const item of verification) {
    if (item?.passing !== true || !item?.id) continue;
    const hasEvidence = evidenceIds.has(item.id);
    evals.push(
      createEval({
        featureId: afterFeature.id,
        category: 'evidence-recording',
        decision: 'evidence_linkage',
        reason: hasEvidence ? 'evidence_recorded' : 'missing_evidence',
        reward: hasEvidence ? 0.5 : -0.3,
        evidence: { verificationId: item.id },
        context: { description: item.description ?? '' },
      })
    );
  }

  return evals;
}
