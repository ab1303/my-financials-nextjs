# scripts/harness/spec-remediation/

Deterministic orchestrator scripts for `spec/index.json` overlap remediation.

**This is the orchestrator only.** Sub-agent dispatch and reasoning happen at
the chat layer via the `task` tool. These scripts contain zero LLM calls.

## Authoritative design

Read **`spec/harness/spec-remediation/lld.md`** for:

- Architecture (deterministic orchestrator ⟷ chat-level agent split)
- File layout and folder convention
- State machine
- Task + Patch JSON schemas
- Script contracts (CLI flags, exit codes)
- Five invariants and the chat-level execution loop
- Cheap-model friendliness checklist
- Acceptance criteria

## Quick reference

```bash
# Discover tasks for a step
node scripts/harness/spec-remediation/discover.mjs --step 1

# Apply one patch (deterministic, with rollback)
node scripts/harness/spec-remediation/apply-patch.mjs --patch .harness/remediation/patches-batch-1/task-step1-t001.json

# Apply a whole batch
node scripts/harness/spec-remediation/apply-batch.mjs --batch 1

# Orientation dashboard
node scripts/harness/spec-remediation/report.mjs
```

## Hard constraints honoured by these scripts

- **No git operations.** No `git commit`, no `git push`. The human commits.
- **No `pnpm`/shell dependencies.** Pure node + filesystem.
- **Atomic manifest writes.** Write-temp + rename; never torn.
- **Idempotent.** Re-applying an applied patch is a no-op.
- **Rollback on overlap regression.** Any `remove-files-from-owns` op that
  does not strictly decrease overlap count is reverted.
- **No LLM calls.** All sub-agent dispatch is initiated from the chat layer.
