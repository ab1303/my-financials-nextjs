# Spec Remediation — Step 2: Invariant Classification

## Task

The **subject** feature is suspected of being a cross-cutting concern — it describes invariants (parity, integrity, audit guarantees) rather than owning a discrete implementation. Decide whether to convert its ownership claims into `invariants[]` text, and optionally reclassify its status. Produce ONE JSON patch.

- Task ID: `{{TASK_ID}}`
- Subject feature LLD: `{{FEATURE_LLD}}`
- Files currently in subject.owns (may overlap with peer features):

{{FILES_LIST}}

## ⚠️ CRITICAL CONSTRAINTS — DO NOT VIOLATE

- You are operating **READ-ONLY**. Tools available: `view`, `grep`, `glob`. You must not modify any file. You must not run shell commands, builds, tests, or git. You must not call `edit`, `create`, `powershell`, or any write tool.
- You may only read files in the `ALLOWED_READS` whitelist below. If a decision requires a file outside the whitelist, set `stop_required: true`.
- Your single output is a JSON object matching `scripts/harness/spec-remediation/schema/patch.schema.json`. No prose. No code fences around the JSON.
- You must not modify `spec/index.json`, any spec markdown file, or any source file. The orchestrator applies your patch deterministically.

## ALLOWED_READS

{{ALLOWED_READS}}

## Doubt-Driven Development protocol (mandatory)

1. **CLAIM**: the subject is a cross-cutting invariant, not an implementation owner. (Or the opposite — record either.)
2. **EXTRACT**: list 2–4 assumptions (e.g. "LLD describes guarantees, not behaviour", "every file in owns has a more specific peer owner", "feature name contains parity/integrity/audit").
3. **DOUBT**: cite `spec/.../lld.md:Lx-y` and `src/...:Lx-y` evidence for each assumption.
4. **RECONCILE**:
   - If the subject IS cross-cutting → emit `set-invariants` (re-express each ownership claim as an invariant sentence) and `set-owns-confidence: "none"`. Optionally `set-status: "adr"` if the LLD is purely a decision record.
   - If the subject genuinely owns its files → emit ONLY `set-owns-confidence` reflecting current state and explain in `rationale`.

## Output contract

Emit exactly one JSON object:

```json
{
  "taskId": "{{TASK_ID}}",
  "step": 2,
  "feature": "<subject feature id>",
  "ops": [
    { "op": "set-invariants", "invariants": ["Files X and Y must remain transactional.", "Z must respect transfer exclusion."] },
    { "op": "set-owns-confidence", "value": "none" }
  ],
  "rationale": "One paragraph (~3 sentences) explaining the classification.",
  "evidence": [
    { "file": "spec/.../lld.md", "lines": "1-30", "supports": "LLD describes guarantees, names no implementation files." }
  ],
  "confidence": "high",
  "stop_required": false,
  "ddd_trace": {
    "spec/.../lld.md": {
      "claim": "Subject is a cross-cutting invariant.",
      "assumptions": [
        { "n": 1, "text": "LLD describes guarantees only.", "result": "✓", "evidence": "spec/.../lld.md:L1-30" }
      ],
      "reconcile": "Reclassify as invariant-only."
    }
  }
}
```

Allowed ops for step 2: `set-invariants`, `set-owns-confidence`, `set-status`. All other ops are rejected at apply time. Every `evidence[].file` must appear in `ALLOWED_READS`.
