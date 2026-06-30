# Manifest Preservation — Low Level Design

> Read `context.md` first.

## Architecture

```
spec/<domain>/<feature>/lld.md        ← input: spec folder structure
              ↓
[ generate-spec-index.mjs ]
   1. Load PREVIOUS spec/index.json (if exists)
   2. Walk spec/ for current feature folders
   3. For each feature:
        - If id in previousFeatures AND no --reset
          → preserve hand-curated fields
        - Else
          → heuristic bootstrap (current behaviour)
   4. Write new spec/index.json
              ↓
spec/index.json                       ← output: preserved
```

## File layout

This feature modifies exactly **one** file:
`scripts/harness/spec-manifest/generate-spec-index.mjs`

No new files. No new buckets in the manifest.

## Preservation table

For each feature being emitted:

| Field | Preserve from previous? | Fallback if no previous |
|---|---|---|
| `id` | n/a (computed from path) | computed |
| `domain` | n/a (computed from path) | computed |
| `path` | n/a (computed from path) | computed |
| `docs` | n/a (computed from folder contents) | computed |
| `status` | **Preserve** | Use `harnessById` map, else `"unknown"` |
| `phase` | **Preserve** | Derived from `status` |
| `owns` | **Preserve** | `inferOwns()` heuristic |
| `consumes` | **Preserve** (already implemented) | Empty buckets |
| `ownsConfidence` | **Preserve** | Computed from heuristic match count |
| `needsReview` | **Preserve** | `true` |
| `lastVerifiedSha` | **Preserve** | `null` |
| `lastVerifiedDate` | **Preserve** | `null` |
| `invariants` | **Preserve** | `[]` |

The rule of thumb: **anything a human or a remediation pipeline might
have edited is preserved**. Anything purely derived from path or folder
structure is recomputed.

## Implementation pattern

The current code (line 176-200 of `generate-spec-index.mjs`):

```js
features.push({
  id, domain, path: `spec/${rel}/`, status, phase, docs,
  owns: { routers, services, components, app, tests },  // hard heuristic
  consumes: cloneRelationBuckets(previousFeature?.consumes),  // ← Stream A preserved
  ownsConfidence: ... heuristic ...,
  needsReview: true,                                    // hard-coded
  lastVerifiedSha: null,                                // hard-coded
  lastVerifiedDate: null,                               // hard-coded
  invariants: [],                                       // hard-coded
});
```

Becomes:

```js
const usePrevious = previousFeature && !RESET_FLAG;

features.push({
  id, domain, path: `spec/${rel}/`, docs,
  status: usePrevious ? previousFeature.status : (harness?.status ?? 'unknown'),
  phase:  usePrevious ? previousFeature.phase  : derivedPhase,
  owns:   usePrevious ? previousFeature.owns   : { routers, services, components, app, tests },
  consumes: cloneRelationBuckets(previousFeature?.consumes),
  ownsConfidence: usePrevious ? previousFeature.ownsConfidence : computedConfidence,
  needsReview:    usePrevious ? previousFeature.needsReview    : true,
  lastVerifiedSha:  usePrevious ? previousFeature.lastVerifiedSha  : null,
  lastVerifiedDate: usePrevious ? previousFeature.lastVerifiedDate : null,
  invariants:       usePrevious ? previousFeature.invariants       : [],
});
```

Plus a top-of-file CLI parse:

```js
const RESET_FLAG = process.argv.includes('--reset');
```

That's the entire functional change. ~15-20 lines net.

## CLI contract

```
pnpm spec:index                # preserve hand-curated fields (default)
pnpm spec:index --reset        # force full bootstrap (destroys hand edits)
```

The `--reset` flag is intentionally undocumented in `package.json`
scripts — it's an emergency tool, not a daily one. Callers who want it
invoke `node scripts/harness/spec-manifest/generate-spec-index.mjs --reset`
directly.

## Invariants

1. **Idempotency.** Running `pnpm spec:index` twice in a row produces
   identical output (ignoring `generatedAt`).
2. **No data loss without `--reset`.** Every field marked "preserve"
   in the table above survives every regeneration.
3. **No regression on new-feature bootstrap.** Creating a fresh
   `spec/<domain>/<feature>/lld.md` and regenerating picks it up with
   heuristic `owns[]` and conservative defaults.
4. **`--reset` is destructive and documented as such** in the script's
   help output and inline comment.

## Acceptance criteria

- [ ] Code change applied; ≤30 lines net diff in
      `generate-spec-index.mjs`.
- [ ] `node generate-spec-index.mjs --help` (or `-h`) prints usage
      mentioning `--reset` (optional but encouraged).
- [ ] **End-to-end test** (manual, scripted in `mp-verify` todo):
  1. Snapshot `spec/index.json` to `spec/index.json.test-bak`.
  2. Add a test invariant to any feature:
     `node -e "..."` to inject `"TEST INVARIANT"` into
     `features[0].invariants`.
  3. Run `pnpm spec:index`.
  4. Confirm test invariant is still present.
  5. Confirm overall diff between pre-edit and post-regenerate
     manifest is **only** `generatedAt` + the injected invariant.
  6. Restore from snapshot.
- [ ] `pnpm spec:check` totals unchanged after a regeneration:
      `drift=43 overlap=0 ghost=0 sha-missing=0 review=0`.
- [ ] One additional check: temporarily rename a feature folder,
      regenerate, confirm the missing-feature entry is dropped
      (i.e. regeneration is not purely additive — it still tracks
      reality). Restore.

## Open questions

None. The design is deliberately simple — there is one decision
("preserve everything hand-curated; reset is explicit") and it has
been made. Implementer subagent should not introduce alternatives.

## Sequencing

This is a small enough feature for **one subagent**, not parallel
streams. Two-stream parallelism is overhead-positive at this size.

```
Phase 0 — Spec finalisation (you are here)
Phase 1 — Single subagent implements per § Implementation pattern
Phase 2 — Orchestrator runs end-to-end verification per § Acceptance
```

Wall-clock target: **20-25 min**.
