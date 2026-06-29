# .harness/ — Session State Directory

This directory contains lightweight runtime state for AI agent sessions.
It is committed to the repo so that state persists across machines and agents.

---

## Files

| File                       | Purpose                                                                       | Updated by                                       |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `feature-status.json`      | Machine-readable feature registry with status + per-feature Definition of Done | Orchestrator at phase/feature completion         |
| `progress.md`              | Human-readable session handoff log                                            | Orchestrator at session end or context threshold |
| `init.sh`                  | Side-effect-free session-start orientation script (run via `bash`)            | Agent at session start (read-only)               |
| `clean-state-checklist.md` | Pre-session-end gate ensuring next session is resumable                       | Agent at session end (mentally / literally)      |

---

## feature-status.json Schema (v1.1)

```jsonc
{
  "schemaVersion": "1.1.0",
  "updatedAt": "ISO 8601 timestamp",
  "rules": {
    "singleActiveFeature": true,        // at most one in-progress feature per branch
    "passingRequiresEvidence": true,    // a verification item flips to passing only with recorded evidence
    "doNotSkipVerification": true,      // status:"done" requires ALL verification[].passing === true
  },
  "statusLegend": { /* self-documenting status names → descriptions */ },
  "features": [
    {
      "id": "kebab-case-feature-id",          // unique, matches spec folder name
      "domain": "domain-name",                // matches spec/{domain}/ folder
      "status": "planned|in-progress|done|blocked",
      "branch": "git-branch-name",            // optional: active git branch
      "spec": "spec/{domain}/{feature}/",     // path to spec folder
      "blockers": ["description of blocker"], // empty array if none
      "completedAt": "ISO 8601",              // set when status = "done"
      "notes": "free text",                   // optional context
      "verification": [                       // machine-readable Definition of Done
        { "id": "type-check", "description": "pnpm run type-check passes", "passing": false },
      ],
      "evidence": [                           // proof entries — append-only
        { "verificationId": "type-check", "at": "ISO 8601", "summary": "0 errors", "commit": "abc1234" },
      ],
    },
  ],
}
```

**Definition of Done rule:** A feature may only transition `in-progress → done` when every
`verification[].passing === true`. Each `passing: true` must have at least one corresponding
entry in `evidence[]` (command output, commit sha, screenshot path).

**Status transitions:**

```
planned → in-progress → done
              ↓
           blocked → in-progress (once unblocked)
```

---

## progress.md Format

```markdown
## YYYY-MM-DD — {feature/branch description}

**Done this session:**

- bullet list of completed work (include file paths)

**Not yet done:**

- bullet list of remaining work

**Current blockers:**

- None / description

**Next session starts at:**

- Read {file} § {section}
- Any other orientation steps
```

---

## Workflow Rules (for agents)

1. **Session start**: `.copilot/hooks.json` registers `bash .harness/init.sh` as a
   `sessionStart` hook — its output is injected into the model's initial context
   automatically. If the hook is disabled or unavailable, run `bash .harness/init.sh`
   manually as the first action.
2. **Phase complete**: Flip the relevant `verification[].passing` to `true` in
   `feature-status.json` and append an `evidence[]` entry (command, commit sha, or screenshot path).
3. **Session end**: `sessionEnd` hooks run **after** the model exits, so they cannot
   enforce wrap-up. The agent must walk `.harness/clean-state-checklist.md` and write
   a new `progress.md` entry (newest first) before its final response.
4. **Context > 50%**: Write `progress.md` entry and start fresh session.
5. **Feature done**: Only allowed when ALL `verification[].passing === true` with matching
   evidence. Then set `status: "done"` and `completedAt`.
