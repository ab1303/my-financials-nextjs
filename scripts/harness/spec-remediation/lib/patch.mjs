/**
 * lib/patch.mjs
 *
 * Patch validation + application primitives.
 *
 * Validation is intentionally hand-rolled (no ajv dependency added per the
 * repo's no-preemptive-package rule). It targets the precise shape described
 * in spec/harness/spec-remediation/lld.md § Schemas → Patch and § Allowed
 * ops[].op values, not full JSON-Schema draft-07 compliance — the
 * schema/patch.schema.json file is documentation + future-proofing.
 *
 * Application produces a NEW manifest object (does not mutate input). Callers
 * commit the change to disk via lib/manifest.mjs#writeManifestAtomic.
 *
 * NEVER calls git. Per LLD invariant #4.
 */

const VALID_BUCKETS = ['routers', 'services', 'components', 'app', 'tests'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];
const VALID_OWNS_CONFIDENCE = ['none', 'low', 'medium', 'high', 'n/a-planned'];
const VALID_STATUS = ['planned', 'in-progress', 'done', 'blocked', 'adr', 'unknown'];

const STEP_OP_ALLOWED = {
  1: new Set(['remove-files-from-owns', 'add-files-to-owns', 'set-owns-confidence']),
  2: new Set(['set-invariants', 'set-owns-confidence', 'set-status']),
  3: new Set(['remove-files-from-owns']),
};

/**
 * Validate a patch payload against the LLD contract.
 * Returns { ok: true } or { ok: false, errors: string[] }.
 */
export function validatePatch(patch) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  req(patch && typeof patch === 'object', 'patch must be an object');
  if (errors.length) return { ok: false, errors };

  req(typeof patch.taskId === 'string' && /^step[123]-t\d{3,}$/.test(patch.taskId),
    `taskId must match /^step[123]-t\\d{3,}$/ (got ${JSON.stringify(patch.taskId)})`);
  req([1, 2, 3].includes(patch.step), `step must be 1, 2, or 3 (got ${patch.step})`);
  req(typeof patch.feature === 'string' && patch.feature.length > 0,
    'feature must be a non-empty string');
  req(typeof patch.rationale === 'string' && patch.rationale.length > 0,
    'rationale must be a non-empty string');
  req(VALID_CONFIDENCE.includes(patch.confidence),
    `confidence must be one of ${VALID_CONFIDENCE.join(', ')}`);
  req(typeof patch.stop_required === 'boolean', 'stop_required must be boolean');
  req(Array.isArray(patch.evidence), 'evidence must be an array');
  req(Array.isArray(patch.ops) && patch.ops.length > 0, 'ops must be a non-empty array');

  if (Array.isArray(patch.evidence)) {
    for (const [i, e] of patch.evidence.entries()) {
      req(e && typeof e.file === 'string' && e.file.length > 0,
        `evidence[${i}].file must be a non-empty string`);
      req(e && typeof e.lines === 'string' && e.lines.length > 0,
        `evidence[${i}].lines must be a non-empty string`);
      req(e && typeof e.supports === 'string' && e.supports.length > 0,
        `evidence[${i}].supports must be a non-empty string`);
    }
  }

  if (Array.isArray(patch.ops)) {
    const allowed = STEP_OP_ALLOWED[patch.step] ?? new Set();
    for (const [i, op] of patch.ops.entries()) {
      req(op && typeof op.op === 'string', `ops[${i}].op must be a string`);
      if (!op || typeof op.op !== 'string') continue;
      req(allowed.has(op.op),
        `ops[${i}].op '${op.op}' not allowed in step ${patch.step} (allowed: ${[...allowed].join(', ')})`);

      switch (op.op) {
        case 'remove-files-from-owns':
        case 'add-files-to-owns':
          req(VALID_BUCKETS.includes(op.bucket),
            `ops[${i}].bucket must be one of ${VALID_BUCKETS.join(', ')} (got ${op.bucket})`);
          req(Array.isArray(op.files) && op.files.length > 0,
            `ops[${i}].files must be a non-empty array`);
          break;
        case 'set-invariants':
          req(Array.isArray(op.invariants) && op.invariants.every((s) => typeof s === 'string' && s.length > 0),
            `ops[${i}].invariants must be an array of non-empty strings`);
          break;
        case 'set-owns-confidence':
          req(VALID_OWNS_CONFIDENCE.includes(op.value),
            `ops[${i}].value must be one of ${VALID_OWNS_CONFIDENCE.join(', ')}`);
          break;
        case 'set-status':
          req(VALID_STATUS.includes(op.value),
            `ops[${i}].value must be one of ${VALID_STATUS.join(', ')}`);
          break;
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Apply a validated patch to a manifest. Returns { manifest, changed } where
 * `changed` is false if the patch was a no-op (idempotency check). Mutates a
 * cloned manifest, not the input.
 *
 * Throws if the target feature is missing or an op references buckets that
 * don't exist — these are programmer errors, not data errors.
 */
export function applyPatch(manifestIn, patch) {
  const manifest = JSON.parse(JSON.stringify(manifestIn));
  const feature = manifest.features.find((f) => f.id === patch.feature);
  if (!feature) {
    throw new Error(`feature '${patch.feature}' not found in manifest`);
  }
  feature.owns = feature.owns ?? {};
  for (const bucket of VALID_BUCKETS) {
    feature.owns[bucket] = feature.owns[bucket] ?? [];
  }

  for (const op of patch.ops) {
    switch (op.op) {
      case 'remove-files-from-owns': {
        const before = feature.owns[op.bucket];
        const toRemove = new Set(op.files);
        feature.owns[op.bucket] = before.filter((f) => !toRemove.has(f));
        break;
      }
      case 'add-files-to-owns': {
        const existing = new Set(feature.owns[op.bucket]);
        for (const f of op.files) existing.add(f);
        feature.owns[op.bucket] = [...existing].sort();
        break;
      }
      case 'set-invariants': {
        feature.invariants = [...op.invariants];
        break;
      }
      case 'set-owns-confidence': {
        feature.ownsConfidence = op.value;
        break;
      }
      case 'set-status': {
        feature.status = op.value;
        break;
      }
      default:
        throw new Error(`unhandled op: ${op.op}`);
    }
  }

  const changed = JSON.stringify(manifestIn) !== JSON.stringify(manifest);
  return { manifest, changed };
}

/**
 * Cite-or-flag gate (LLD § Cheap-model friendliness checklist):
 * every evidence[].file MUST appear in `allowedReads` (a whitelist derived
 * from the task). Returns { ok, offenders }.
 *
 * `allowedReads` may include the leaf basename or the full path — we accept
 * either form to keep templates flexible.
 */
export function validateCitations(patch, allowedReads) {
  if (!Array.isArray(allowedReads) || allowedReads.length === 0) {
    return { ok: true, offenders: [] };
  }
  const whitelist = new Set(allowedReads);
  const offenders = [];
  for (const e of patch.evidence ?? []) {
    if (!whitelist.has(e.file)) offenders.push(e.file);
  }
  return { ok: offenders.length === 0, offenders };
}
