# Spec Remediation — Step 1: Scope-Down

## Task

You are auditing a single candidate scope-down: deciding which files currently claimed by the **subject** feature actually belong to the **target** sub-feature instead. Produce ONE JSON patch.

- Task ID: `{{TASK_ID}}`
- Subject feature LLD: `{{FEATURE_LLD}}`
- Target sub-feature LLD: `{{TARGET_FEATURE_LLD}}`
- Candidate files (currently owned by subject; may belong to target):

{{FILES_LIST}}

## ⚠️ CRITICAL CONSTRAINTS — DO NOT VIOLATE

- You are operating **READ-ONLY**. Tools available: `view`, `grep`, `glob`. You must not modify any file. You must not run shell commands, builds, tests, or git. You must not call `edit`, `create`, `powershell`, or any write tool.
- You may only read files in the `ALLOWED_READS` whitelist below. Reading outside this list is a protocol violation; if a citation requires a file not on the list, set `stop_required: true` and explain.
- Your single output is a JSON object matching `scripts/harness/spec-remediation/schema/patch.schema.json`. No prose. No code fences around the JSON. No follow-up turns.
- You must not modify `spec/index.json`, any spec markdown file, or any source file. The orchestrator applies your patch deterministically.

## ALLOWED_READS

{{ALLOWED_READS}}

## Doubt-Driven Development protocol (mandatory)

For EACH candidate file, run CLAIM → EXTRACT → DOUBT → RECONCILE:

1. **CLAIM**: state, in one sentence, why the file might belong to the target sub-feature.
2. **EXTRACT**: list the 1–3 assumptions your claim depends on (e.g. "the target's LLD describes function X", "the file exports X").
3. **DOUBT**: for each assumption, find evidence in the whitelisted files. Cite `file:line`.
4. **RECONCILE**: if every assumption holds with high-confidence evidence → include the file in a `remove-files-from-owns` op against the subject. If any assumption fails or the evidence is ambiguous → exclude the file and capture the doubt in `rationale`. If the decision is genuinely undecidable from the whitelisted reads → set `stop_required: true`.

## Output contract

Emit exactly one JSON object with this shape (see `schema/patch.schema.json` for the full grammar):

```json
{
  "taskId": "{{TASK_ID}}",
  "step": 1,
  "feature": "<subject feature id>",
  "ops": [
    { "op": "remove-files-from-owns", "bucket": "services", "files": ["..."] }
  ],
  "rationale": "One paragraph (~3 sentences) summarising the DDD reconciliation.",
  "evidence": [
    { "file": "src/...", "lines": "30-34", "supports": "Implements X per target/lld.md:L5-7" }
  ],
  "confidence": "high",
  "stop_required": false,
  "ddd_trace": {
    "src/...": {
      "claim": "...",
      "assumptions": [
        { "n": 1, "text": "...", "result": "✓", "evidence": "spec/.../lld.md:L12" }
      ],
      "reconcile": "Proceed — move to target."
    }
  }
}
```

Allowed ops for step 1: `remove-files-from-owns`, `add-files-to-owns`, `set-owns-confidence`. All other ops are rejected at apply time. Every `evidence[].file` must appear in `ALLOWED_READS`.
