# harness.session-close — Low Level Design

## Feature summary

`harness.session-close` provides a single script (`close.mjs`) that automates the
deterministic portion of the session-end ritual defined in `AGENTS.md § Session Lifecycle`.

The agent runs `node scripts/harness/session-close/close.mjs`, reviews the diff-style
output, fills in the `<!-- narrative -->` block in `progress.md`, then commits.

---

## Phase map

```
Phase 1 — close.mjs (Stream A)           ← standalone; no deps
Phase 2 — hooks.json + AGENTS.md (Stream B)  ← standalone; no deps
Phase 3 — Spec files (Stream C)          ← standalone; no deps (these files!)
Phase 4 — Manifest registration (Stream D)  ← depends on Phase 3 spec existing

Phases 1, 2, 3 → parallel (Wave 1)
Phase 4 → sequential (Wave 2, after Phase 3)
```

---

## Streams

### Stream A — `close.mjs`

**Owns (will create):**
- `scripts/harness/session-close/close.mjs`

**CLI contract:**
```
node scripts/harness/session-close/close.mjs [--feature <id>] [--dry-run]
```

Flags:
- `--feature <id>` — override auto-detected active feature (default: first `status === "in-progress"` in feature-status.json)
- `--dry-run` — (default: `false`) print what would be written without touching disk

**Algorithm:**

1. **Detect active feature** — read `.harness/feature-status.json`; find first entry with `status === "in-progress"`. If `--feature <id>` provided, use that instead.

2. **Run Verification Gate** — spawn three child processes:
   - `pnpm run type-check` → record exit code + stdout tail (last 3 lines)
   - `pnpm run lint` → record exit code + stdout tail
   - `node scripts/harness/spec-manifest/spec-check.mjs` → record exit code + tail
   Capture combined output. Mark each as `passing: true` if exit code 0.

3. **Update `feature-status.json`** — for each of the 3 automated gate IDs
   (`type-check`, `lint`, `spec-check`) that exist in the feature's `verification[]`:
   - Set `passing: true` if exit 0, `false` otherwise
   - Append to (or update) `evidence[]` with `{ id, sha: <HEAD sha>, command, result }`
   - If ALL `verification[].passing` are now `true` → set `status: "done"` + `completedAt: <ISO date>`
   - Idempotent: running twice does not double-append evidence; match on `id`.

4. **Rotate `progress.md`** (if feature just became `done`):
   - Read current `.harness/progress.md` (strip the header block — lines before first `## `)
   - Prepend the closed entry to `.harness/progress-history.md` (newest first)
   - Overwrite `.harness/progress.md` with the generated template (see § Template below)

5. **Stamp `lastVerifiedSha`** in `spec/index.json`:
   - Find the feature's entry by `id`; set `lastVerifiedSha` to current `HEAD` git sha
   - Set `lastVerifiedDate` to ISO date string

6. **Print diff-style summary** — list every file written with ✅/❌ + short description.
   End with: `"Review the <!-- narrative --> block in .harness/progress.md, then commit."`

7. **Stage harness files** (unless `--dry-run`):
   - `git add .harness/feature-status.json .harness/progress.md .harness/progress-history.md spec/index.json`
   - Print the commit command (never `git commit` itself)

**Exit codes:**
- `0` — all gates pass
- `1` — one or more gates fail (feature stays `in-progress`)
- `2` — feature-status.json missing or malformed
- `3` — no active feature found

**Idempotency guarantee:** running `close.mjs` twice with no intervening changes must produce the same output. Specifically: no duplicate evidence entries, no duplicate `progress-history.md` prepends, same `lastVerifiedSha`.

---

### Stream B — `hooks.json` + `AGENTS.md`

**Owns (will modify):**
- `.github/hooks/hooks.json`
- `AGENTS.md`

**hooks.json change — add `sessionEnd`:**
```json
"sessionEnd": [
  {
    "bash": "node scripts/harness/session-close/close.mjs 2>&1 || true",
    "powershell": "node scripts/harness/session-close/close.mjs 2>&1; exit 0",
    "cwd": ".",
    "timeoutSec": 60
  }
]
```

The hook runs `|| true` / `exit 0` so it never blocks the IDE on failure. Its output
is informational only — it's a safety net for when the agent forgets to run the script
manually.

**AGENTS.md change — Session Lifecycle § End:**
Replace the current bullet list with a reference to the script:
```markdown
**End.**  Run `node scripts/harness/session-close/close.mjs`. Review output.
Fill the `<!-- narrative -->` block in `.harness/progress.md`. Ask the user to confirm
the generated `git commit` command. Manual steps that remain: extend narrative,
update `lld.md` acceptance criteria, update `docs/harness-audit.md` (all require judgment).
```

---

### Stream C — Spec files (this file + context.md)

**Owns (will create):**
- `spec/harness/session-close/context.md`
- `spec/harness/session-close/lld.md`

These files ARE Stream C. No additional implementation required for this stream.

---

### Stream D — Manifest + HLD registration

**Owns (will modify):**
- `spec/index.json` — add `harness.session-close` entry; update `totals.features` (95 → 96)
- `spec/harness/hld.md` — add to Catalogue table; remove from Planned list

**spec/index.json entry:**
```json
{
  "id": "harness.session-close",
  "domain": "harness",
  "path": "spec/harness/session-close/",
  "status": "planned",
  "phase": "design",
  "docs": {
    "context": "spec/harness/session-close/context.md",
    "lld": "spec/harness/session-close/lld.md"
  },
  "owns": {
    "routers": [],
    "services": ["scripts/harness/session-close/close.mjs"],
    "components": [],
    "app": [],
    "tests": []
  },
  "ownsConfidence": "high",
  "needsReview": false,
  "lastVerifiedSha": null,
  "lastVerifiedDate": null,
  "invariants": [
    "close.mjs never calls git commit — staging only (Hard Constraint).",
    "Running close.mjs twice with no intervening changes is idempotent.",
    "All verification gate results are recorded in feature-status.json evidence[].",
    "No LLM in the runtime loop — pure Node.js child_process + string templating."
  ],
  "consumes": {
    "routers": [],
    "services": [],
    "components": [],
    "app": [],
    "tests": []
  }
}
```

---

## Generated `progress.md` template

```markdown
## {ISO date} — {feature.id} — {COMPLETE ✅ | IN PROGRESS}

### Verification gate (auto-stamped by close.mjs @ {sha})

| Check | Result |
|---|---|
| `pnpm run type-check` | ✅ / ❌ {error count or exit code} |
| `pnpm run lint` | ✅ / ❌ {error count or exit code} |
| `pnpm spec:check` | ✅ / ❌ drift={n} overlap={n} ghost={n} |

### What was done
<!-- close.mjs: populated from feature-status.json notes field -->
{feature.notes}

### Open verification items
<!-- close.mjs: list verification[].passing===false, or "None — feature complete" -->
{open items or "None — all verification items passing"}

### Next up
<!-- Agent: replace this block with narrative + chosen workstream -->
<!-- Planned features from feature-status.json with status:"planned": -->
{list of planned feature ids}

### Next session starts at
<!-- Agent: fill in the specific file + section or command to resume from -->
```

---

## Open questions

1. **`spec:check` is async (capsule integration added an await)** — `close.mjs` should use `node scripts/harness/spec-manifest/spec-check.mjs` as a child process (not `require()`). Leaning: always spawn as child process.

2. **What if no feature is `in-progress`?** Leaning: exit code 2 with a clear message ("No in-progress feature found in feature-status.json. Use --feature <id> to specify one.").

3. **Spec-check output parsing** — the script needs to extract `drift=N overlap=N ghost=N` from spec-check.mjs output. Leaning: regex match on the summary line already printed by spec-check.mjs.

4. **Evidence ID collision** — if `type-check` evidence already exists, overwrite (last-write wins) vs. append new entry. Leaning: overwrite/replace by `id` to keep evidence[] compact.

5. **`pnpm run` vs `node` for gates** — spawning `pnpm run type-check` is slower but respects workspace config. Leaning: use `pnpm run type-check` and `pnpm run lint`; use `node scripts/harness/spec-manifest/spec-check.mjs` directly for spec:check.

---

## Acceptance criteria

- [ ] `node scripts/harness/session-close/close.mjs` with an `in-progress` feature:
  - Runs all 3 gates; records results in `feature-status.json`
  - Writes `progress.md` with the generated template (no duplicate headers)
  - Prepends to `progress-history.md` if feature transitions to `done`
  - Stamps `lastVerifiedSha` in `spec/index.json`
  - Stages harness files; never calls `git commit`
  - Prints a diff-style summary
- [ ] Running `close.mjs` twice produces the same output (idempotent)
- [ ] `--dry-run` prints what would be written without touching disk
- [ ] `pnpm run type-check` passes (zero errors)
- [ ] `pnpm run lint` passes (zero errors)

---

## Cross-cutting invariants (inherited from `spec/harness/hld.md`)

1. Harness scripts that edit harness state files must not bypass their own gates.
2. Tier 3 operations (git push, db push) require user confirmation — never called from `close.mjs`.
3. Subagent invocations follow the `⚠️ CRITICAL CONSTRAINTS` contract.
4. Cheap-model friendliness — no LLM in the runtime loop.
