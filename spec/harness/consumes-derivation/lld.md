# Consumes Derivation — Low Level Design

> Read `context.md` first for the motivation. This document specifies
> file contracts, parallel decomposition, and acceptance gates.

## Architecture

```
[ TypeScript source files (src/**/*.ts{,x}) ]   ← source of truth
                  │
                  ▼
[ scripts/harness/consumes-derivation/derive.mjs ]
   - reads owns[] → reverse index file→owner
   - parses imports, resolves via tsconfig paths
   - emits per-feature consumes[]
                  │
                  ▼
[ spec/index.json features[*].consumes ]          ← derived cache
                  │
                  ▼
[ spec/harness/spec-manifest/spec-check.mjs ]
   - overlap calc reads owns[] ONLY
   - consumes[] is informational, never flagged
```

**No LLM in the runtime loop.** Subagents are used only to *author the
scripts during build* — not when running them.

## File layout

```
spec/harness/consumes-derivation/
├── context.md                    (this feature)
└── lld.md                        (this file)

scripts/harness/consumes-derivation/
├── derive.mjs                    # main entry: import graph → consumes[]
├── leaky-report.mjs              # secondary: cross-feature internal imports
├── lib/
│   └── resolve.mjs               # tsconfig path resolution
└── README.md                     # short pointer to this LLD
```

**Manifest schema additions:**

- `conventions.relations` (new top-level key): `["owns", "consumes", "invariants"]`
- `features[*].consumes`: same bucket shape as `owns[]`:
  ```jsonc
  "consumes": {
    "routers":    [],
    "services":   [],
    "components": [],
    "app":        [],
    "tests":      []
  }
  ```

## Parallel streams (the load-bearing part of this LLD)

The implementation decomposes into **four independent streams** that
can be dispatched as parallel subagents. Each ends with a
unit-verifiable artifact and touches a disjoint section of files.

### Stream A — Manifest schema extension

**Subagent role:** schema engineer.

**Owns (will modify):**
- `scripts/harness/spec-manifest/generate-spec-index.mjs`

**Tasks:**
1. Add `consumes` to the `conventions` vocabulary (new top-level
   `conventions.relations` array if not present, else extend it).
2. In the generator, emit `consumes: { routers: [], services: [],
   components: [], app: [], tests: [] }` for every feature on
   regeneration.
3. Preserve any hand-curated `consumes[]` entries across regeneration
   (mirror the existing `owns[]` preservation policy).

**Done when:**
- `pnpm spec:generate` produces a manifest where every feature has an
  empty (or preserved) `consumes` block.
- `pnpm spec:check` still passes with no behaviour change.

### Stream B — Derivation script

**Subagent role:** TypeScript / Node implementer.

**Owns (will create):**
- `scripts/harness/consumes-derivation/derive.mjs`
- `scripts/harness/consumes-derivation/lib/resolve.mjs`
- `scripts/harness/consumes-derivation/README.md`

**Algorithm:**
1. Load `spec/index.json`. Build reverse index: `Map<absoluteFilePath,
   featureId>` from every feature's `owns[]`.
2. Load `tsconfig.json`. Extract `compilerOptions.paths` (e.g. `@/*`
   → `./src/*`).
3. For each `(featureId, ownedFile)` pair:
   - Read the file's source.
   - Parse `import` statements. Primary: regex
     `/^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/gm`. Fallback
     to `ts-morph` only if regex underperforms on edge cases.
   - For each import specifier:
     a. If it starts with `.` or `..` → resolve relative to the file.
     b. Else if it matches a `tsconfig` path → resolve via that.
     c. Else (bare specifier) → external; skip.
   - Look up resolved absolute path in the reverse index.
   - If the consumed file's owner ≠ the current `featureId`, append
     the consumed file (deduped) to `current.consumes[bucket]`, where
     `bucket` is derived from the consumed file's path prefix (same
     mapping the generator already uses for `owns[]`).
4. Write manifest with populated `consumes[]`.

**Invariants enforced by the script:**
- Idempotent: same source tree + same manifest → identical output.
- Non-destructive: never reads or writes `owns[]` or `invariants[]`.
- Deterministic ordering: arrays sorted alphabetically before write.

**Exit codes:**
- 0 — success.
- 2 — malformed `tsconfig.json`.
- 3 — manifest reverse-index has duplicate ownership (should never
  happen post-remediation; surface as a regression).

**Done when:**
- Running on the current manifest produces non-empty `consumes[]` for
  at least the 10 features known to import shared UI primitives.
- Re-running immediately after produces zero manifest diff.

### Stream C — `spec:check` additive guard

**Subagent role:** small-scope script editor.

**Owns (will modify, narrowly):**
- `scripts/harness/spec-manifest/spec-check.mjs`

**Change:** The overlap calculator currently iterates files in every
feature's `owns[]`. This must not change. Add a guard / explicit
comment that the walker is `owns[]`-only, never touching `consumes[]`.
If the implementer finds the walker already uses an `owns`-keyed
iteration, the change may be limited to a comment + a defensive
assertion in tests.

**Done when:**
- With a manifest containing populated `consumes[]`, `spec:check`
  reports the same overlap count and same finding list as before the
  field was added (snapshot test).

### Stream D — Feature registration & harness HLD update

**Subagent role:** spec librarian.

**Owns (will modify):**
- `spec/index.json` (add `harness.consumes-derivation` feature entry)
- `spec/harness/hld.md` (move this feature from "Planned" list to
  "Catalogue" table)

**Tasks:**
1. Add manifest entry:
   ```jsonc
   "harness.consumes-derivation": {
     "id": "harness.consumes-derivation",
     "domain": "harness",
     "path": "spec/harness/consumes-derivation/",
     "status": "in-progress",
     "phase": "build",
     "docs": {
       "context": "spec/harness/consumes-derivation/context.md",
       "lld":     "spec/harness/consumes-derivation/lld.md"
     },
     "owns": {
       "routers": [], "services": [
         "scripts/harness/consumes-derivation/derive.mjs",
         "scripts/harness/consumes-derivation/leaky-report.mjs",
         "scripts/harness/consumes-derivation/lib/resolve.mjs"
       ],
       "components": [], "app": [], "tests": []
     },
     "ownsConfidence": "high",
     "needsReview": false,
     "lastVerifiedSha": null,
     "lastVerifiedDate": null,
     "invariants": [
       "Derivation is mechanical; no LLM in the runtime loop.",
       "consumes[] is a derived cache — never edit by hand without re-deriving.",
       "Idempotent: re-running derive.mjs on unchanged sources produces zero diff."
     ]
   }
   ```
2. In `spec/harness/hld.md` "Catalogue of harness features" table, add
   the row for this feature with status `in-progress`. Remove it from
   the "Planned" list below the table.

**Done when:**
- `pnpm spec:check` recognises the new feature and reports zero
  overlap on its declared `owns[]`.

## Sequencing & parallelism

```
Phase 0 — Spec finalisation (already done by reading this doc)
   └─ ≈ already complete

Phase 1 — Parallel implementation (target ≤ 15 min wall-clock)
   ├─ Stream A: schema extension          ──┐
   ├─ Stream B: derivation script           │ four subagents
   ├─ Stream C: spec-check guard            │ dispatched simultaneously
   └─ Stream D: feature registration      ──┘

Phase 2 — Integration (sequential, ≈ 5 min)
   ├─ Run: pnpm spec:generate              (re-emits schema from Stream A)
   ├─ Run: node scripts/harness/consumes-derivation/derive.mjs
   ├─ Run: pnpm spec:check                 (expect unchanged overlap totals)
   └─ Eyeball: top-10 features by consumes[] count for sanity

Phase 3 — Optional follow-up (parallel-able)
   └─ Run leaky-report.mjs → .harness/leaky-imports.md → human triage
```

**Wall-clock target: ≤ 25 minutes total.**

### Why these streams are genuinely independent

| Stream | Reads | Writes | Potential conflicts |
|---|---|---|---|
| A | `generate-spec-index.mjs` source | same file | None — adds a new field; existing code paths unchanged |
| B | manifest (read-only at design time) | only new files | None |
| C | `spec-check.mjs` source | same file | None — additive guard / comment, separate logical section |
| D | manifest, `harness/hld.md` | same files | A regenerates manifest later (Phase 2); D's hand-edit survives by the existing preserve-hand-curated convention |

**One ordering constraint:** in Phase 2, run `spec:generate` (Stream A's
output) **before** `derive.mjs` (Stream B) so the empty `consumes[]`
blocks exist for Stream B to populate. This is enforced by the Phase 2
script order, not by Phase 1 dispatch order.

## Invariants (run on every CI / pre-push invocation)

1. **`owns[]` semantics unchanged.** This feature adds a parallel
   relation; it does not redefine the existing one.
2. **Derivation is deterministic.** Same source tree + same manifest
   → identical `consumes[]` output. Asserted by re-run-diff check.
3. **No LLM at runtime.** `derive.mjs` and `leaky-report.mjs` make
   zero network calls.
4. **Leaky findings are informational.** They do not fail
   `spec:check`. Enforcement is a separate, future decision.

## Acceptance criteria

- [ ] Every feature in `spec/index.json` has a `consumes` block
      (possibly empty, all five buckets present).
- [ ] Re-running `derive.mjs` immediately produces zero manifest diff.
- [ ] `spec:check` overlap count unchanged from pre-feature baseline.
- [ ] Top-10 features by `consumes.components.length` look sane on
      eyeball review (shared UI primitives should dominate).
- [ ] `leaky-report.mjs` runnable; first output committed to
      `.harness/leaky-imports.md` for triage.
- [ ] `docs/harness-audit.md` "Still Open" list amended with this
      closure entry.

## Open questions

1. **Bucket consistency:** does `consumes[]` use the same five buckets
   as `owns[]`, or collapse into a flat list? Lean toward same buckets
   for parser symmetry — decided unless Stream B finds a concrete reason
   to deviate.
2. **Type-only imports:** should `import type { X }` count as
   consumption? Lean yes — a type contract breakage is still a
   breakage. Decided unless Stream B flags a noise problem.
3. **Re-export chains:** `export { X } from './internal'` from feature
   A's barrel, consumed by feature B — is B consuming A's barrel
   (public) or A's internal (leak)? Lean: count the barrel as
   consumed; surface the chain in `leaky-report.mjs`. Decided.

None of these block dispatch. Implementer subagents resolve them
inline using the leaning recorded here.
