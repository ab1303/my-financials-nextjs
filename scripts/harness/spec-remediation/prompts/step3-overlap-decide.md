# Spec Remediation — Step 3: Overlap Decision

## Task

A single source file is claimed by **two or more** features. Decide which feature is the canonical owner; the rest must yield. Produce ONE JSON patch that removes the file from the non-owners. The canonical owner keeps it — no `add-files-to-owns` op is needed (the file is already there).

- Task ID: `{{TASK_ID}}`
- Contested file(s) currently in dispute:

{{FILES_LIST}}

- Subject feature LLD (the feature you'll modify; could be a non-owner from which the file is removed): `{{FEATURE_LLD}}`
- All claimant feature LLDs:

{{CLAIMANT_LLDS}}

## ⚠️ CRITICAL CONSTRAINTS — DO NOT VIOLATE

- You are operating **READ-ONLY**. Tools available: `view`, `grep`, `glob`. You must not modify any file. You must not run shell commands, builds, tests, or git. You must not call `edit`, `create`, `powershell`, or any write tool.
- You may only read files in the `ALLOWED_READS` whitelist below. If picking a canonical owner requires reading outside the whitelist, set `stop_required: true` and name the file you would need.
- Your single output is a JSON object matching `scripts/harness/spec-remediation/schema/patch.schema.json`. No prose. No code fences around the JSON.
- You must not modify `spec/index.json`, any spec markdown file, or any source file. The orchestrator applies your patch deterministically.
- This patch removes the file from ONE feature (the `feature` field). If the decision implies multiple removals across multiple features, set `stop_required: true` and describe the multi-feature plan — the orchestrator will split it into separate tasks.

## ALLOWED_READS

{{ALLOWED_READS}}

## Doubt-Driven Development protocol (mandatory)

1. **CLAIM**: name the canonical owner and state, in one sentence, why.
2. **EXTRACT**: list 2–4 assumptions (e.g. "the contested file implements function X", "claimant A's LLD names function X explicitly", "claimant B's LLD describes a different responsibility").
3. **DOUBT**: cite `file:line` evidence for each assumption — both LLD lines and source-file lines.
4. **RECONCILE**:
   - If a canonical owner emerges with high-confidence evidence → emit `remove-files-from-owns` against the LOSING claimant (set `feature` to the loser's id). For each loser, emit a separate task — this prompt handles one loser per invocation.
   - If two LLDs make equally valid claims OR neither LLD names the file → set `stop_required: true` with a `rationale` framing the choice the human must make.

## Output contract

Emit exactly one JSON object:

```json
{
  "taskId": "{{TASK_ID}}",
  "step": 3,
  "feature": "<losing feature id>",
  "ops": [
    { "op": "remove-files-from-owns", "bucket": "components", "files": ["src/..."] }
  ],
  "rationale": "One paragraph (~3 sentences) naming the canonical owner and the boundary decision.",
  "evidence": [
    { "file": "spec/<canonical>/lld.md", "lines": "12-18", "supports": "Canonical owner explicitly names this file." },
    { "file": "src/...", "lines": "1-10", "supports": "File header/imports align with canonical owner's scope." }
  ],
  "confidence": "high",
  "stop_required": false,
  "ddd_trace": {
    "src/...": {
      "claim": "<canonical id> owns this file.",
      "assumptions": [
        { "n": 1, "text": "Canonical LLD names the file.", "result": "✓", "evidence": "spec/.../lld.md:L12" }
      ],
      "reconcile": "Remove from loser."
    }
  }
}
```

Allowed op for step 3: `remove-files-from-owns` only. All other ops are rejected at apply time. Every `evidence[].file` must appear in `ALLOWED_READS`.
