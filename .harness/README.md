# .harness/ — Session State Directory

This directory contains lightweight runtime state for AI agent sessions.
It is committed to the repo so that state persists across machines and agents.

---

## Files

| File                  | Purpose                                       | Updated by                                       |
| --------------------- | --------------------------------------------- | ------------------------------------------------ |
| `feature-status.json` | Machine-readable feature registry with status | Orchestrator at phase/feature completion         |
| `progress.md`         | Human-readable session handoff log            | Orchestrator at session end or context threshold |

---

## feature-status.json Schema

```jsonc
{
  "schemaVersion": "1.0.0",
  "updatedAt": "ISO 8601 timestamp",
  "features": [
    {
      "id": "kebab-case-feature-id", // unique, matches spec folder name
      "domain": "domain-name", // matches spec/{domain}/ folder
      "status": "planned|in-progress|done|blocked",
      "branch": "git-branch-name", // optional: active git branch
      "spec": "spec/{domain}/{feature}/", // path to spec folder
      "blockers": ["description of blocker"], // empty array if none
      "completedAt": "ISO 8601", // set when status = "done"
      "notes": "free text", // optional context
    },
  ],
}
```

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

1. **Session start**: Read `progress.md` (latest entry) + run `git log --oneline -5` before doing anything.
2. **Phase complete**: Update `progress.md` with what was done. Optionally update `feature-status.json`.
3. **Session end**: Always write a new `progress.md` entry — even for short sessions.
4. **Context > 50%**: Write `progress.md` entry and start fresh session.
5. **Feature done**: Set `status: "done"` and `completedAt` in `feature-status.json`.
